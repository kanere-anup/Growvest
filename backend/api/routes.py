"""
API routes for the Stock Market Scanner
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, Depends
from fastapi.responses import FileResponse
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio
import json
from pathlib import Path

from core.database import db_manager, Scan, ScanResult as DBScanResult, Stock
from services.scanner import OptimizedStockScanner, ScanConfig
from api.schemas import (
    ScanRequest, ScanResponse, ScanStatus, ScanResult, StrategyInfo,
    StockCreate, StockUpdate, StockOut
)
from loguru import logger

# Initialize router
api_router = APIRouter()

# Auth deps
from auth.service import get_current_user_from_access_token, csrf_protect

# Global scan status tracking
active_scans: Dict[int, Dict[str, Any]] = {}


@api_router.get("/strategies", response_model=List[StrategyInfo])
async def get_strategies():
    """Get available strategies"""
    from core.config import StrategyConfig
    
    strategies = []
    for name, config in StrategyConfig.STRATEGIES.items():
        strategies.append(StrategyInfo(
            name=name,
            display_name=config['name'],
            description=config['description'],
            enabled=config['enabled'],
            priority=config['priority']
        ))
    
    return strategies


@api_router.post("/scan", response_model=ScanResponse)
async def start_scan(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user_from_access_token),
    _csrf: None = Depends(csrf_protect),
):
    """Start a new stock scan"""
    try:
        logger.info(
            "Start scan requested: strategies=%s symbols=%s",
            len(request.strategies) if request.strategies else "default",
            len(request.symbols) if request.symbols else "active",
        )
        # Create scan configuration
        config = ScanConfig(
            strategies=request.strategies,
            symbols=request.symbols,
            max_concurrent=request.max_concurrent,
            timeout=request.timeout
        )
        
        # Pre-create scan record to obtain a valid scan_id for response
        scan_data = {
            'status': 'running',
            'total_stocks': len(config.symbols),
            'successful_stocks': 0,
            'failed_stocks': 0,
            'strategies_run': json.dumps(config.strategies)
        }
        scan_id = db_manager.save_scan(scan_data)

        # Create scanner bound to this scan_id
        scanner = OptimizedStockScanner(config, scan_id=scan_id)
        
        # Start scan in background
        scan_task = asyncio.create_task(scanner.run_scan())
        
        # Store scan info
        scan_info = {
            'task': scan_task,
            'scanner': scanner,
            'start_time': datetime.utcnow()
        }
        active_scans[scan_id] = scan_info
        
        return ScanResponse(
            scan_id=scan_id,
            status="started",
            message=f"Scan started with {len(config.strategies)} strategies for {len(config.symbols)} stocks"
        )
        
    except Exception as e:
        logger.exception("Failed to start scan")
        raise HTTPException(status_code=500, detail=f"Failed to start scan: {str(e)}")


@api_router.get("/scan/{scan_id}/status", response_model=ScanStatus)
async def get_scan_status(scan_id: int):
    """Get scan status"""
    try:
        logger.debug(f"Status requested for scan_id={scan_id}")
        # Check if scan is still active
        if scan_id in active_scans:
            scan_info = active_scans[scan_id]
            task = scan_info['task']
            
            if task.done():
                try:
                    result = await task
                    # Remove from active scans
                    del active_scans[scan_id]
                    
                    return ScanStatus(
                        scan_id=scan_id,
                        status="completed",
                        total_stocks=result.get('successful_stocks', 0) + result.get('failed_stocks', 0),
                        successful_stocks=result.get('successful_stocks', 0),
                        failed_stocks=result.get('failed_stocks', 0),
                        execution_time=result.get('execution_time', 0),
                        strategies_run=list(result.get('results_by_strategy', {}).keys()),
                        results_summary=result.get('results_by_strategy', {}),
                        created_at=scan_info['start_time'],
                        completed_at=datetime.utcnow()
                    )
                except Exception as e:
                    return ScanStatus(
                        scan_id=scan_id,
                        status="failed",
                        total_stocks=0,
                        successful_stocks=0,
                        failed_stocks=0,
                        execution_time=0,
                        strategies_run=[],
                        results_summary={},
                        created_at=scan_info['start_time'],
                        completed_at=datetime.utcnow()
                    )
            else:
                return ScanStatus(
                    scan_id=scan_id,
                    status="running",
                    total_stocks=0,
                    successful_stocks=0,
                    failed_stocks=0,
                    execution_time=0,
                    strategies_run=[],
                    results_summary={},
                    created_at=scan_info['start_time']
                )
        
        # Check database for completed scans
        session = db_manager.get_session()
        try:
            scan = session.query(Scan).filter(Scan.id == scan_id).first()
            if scan:
                return ScanStatus(
                    scan_id=scan.id,
                    status=scan.status,
                    total_stocks=scan.total_stocks,
                    successful_stocks=scan.successful_stocks,
                    failed_stocks=scan.failed_stocks,
                    execution_time=scan.execution_time,
                    strategies_run=json.loads(scan.strategies_run) if scan.strategies_run else [],
                    results_summary=json.loads(scan.results_summary) if scan.results_summary else {},
                    created_at=scan.timestamp,
                    completed_at=scan.completed_at
                )
            else:
                raise HTTPException(status_code=404, detail="Scan not found")
        finally:
            db_manager.close_session(session)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting scan status for scan_id={scan_id}")
        raise HTTPException(status_code=500, detail=f"Error getting scan status: {str(e)}")


@api_router.get("/scan/{scan_id}/results", response_model=List[ScanResult])
async def get_scan_results(
    scan_id: int,
    strategy: Optional[str] = Query(None, description="Filter by strategy name")
):
    """Get scan results"""
    try:
        results = db_manager.get_scan_results(scan_id, strategy)
        return [
            ScanResult(
                id=result['id'],
                strategy_name=result['strategy_name'],
                symbol=result['symbol'],
                current_price=result['current_price'],
                result_data=result['result_data'],
                score=result['score'],
                created_at=result['created_at']
            )
            for result in results
        ]
    except Exception as e:
        logger.exception(f"Error getting scan results for scan_id={scan_id}")
        raise HTTPException(status_code=500, detail=f"Error getting scan results: {str(e)}")


@api_router.get("/scans", response_model=List[ScanStatus])
async def get_recent_scans(limit: int = Query(10, ge=1, le=100)):
    """Get recent scan sessions"""
    try:
        scans = db_manager.get_recent_scans(limit)
        return [
            ScanStatus(
                scan_id=scan['id'],
                status=scan['status'],
                total_stocks=scan['total_stocks'],
                successful_stocks=scan['successful_stocks'],
                failed_stocks=0,  # Not stored in recent scans
                execution_time=scan['execution_time'],
                strategies_run=scan['strategies_run'],
                results_summary={},
                created_at=scan['timestamp']
            )
            for scan in scans
        ]
    except Exception as e:
        logger.exception("Error getting recent scans")
        raise HTTPException(status_code=500, detail=f"Error getting recent scans: {str(e)}")


@api_router.get("/scan/{scan_id}/export")
async def export_scan_results(scan_id: int):
    """Export scan results to Excel"""
    try:
        filepath = db_manager.export_scan_to_excel(scan_id)
        return FileResponse(
            path=filepath,
            filename=Path(filepath).name,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        logger.exception(f"Error exporting results for scan_id={scan_id}")
        raise HTTPException(status_code=500, detail=f"Error exporting results: {str(e)}")


@api_router.get("/analytics/performance")
async def get_strategy_performance(days: int = Query(30, ge=1, le=365)):
    """Get strategy performance analytics"""
    try:
        performance = db_manager.get_strategy_performance(days)
        return performance
    except Exception as e:
        logger.exception("Error getting performance data")
        raise HTTPException(status_code=500, detail=f"Error getting performance data: {str(e)}")


@api_router.get("/analytics/top-stocks")
async def analytics_top_stocks(
    days: int = Query(30, ge=1, le=365),
    strategy: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=100)
):
    """Top stocks by frequency (and avg score) within the last N days."""
    try:
        data = db_manager.get_top_stocks(days=days, strategy=strategy, limit=limit)
        return data
    except Exception as e:
        logger.exception("Error getting top stocks")
        raise HTTPException(status_code=500, detail=f"Error getting top stocks: {str(e)}")


@api_router.get("/analytics/stock-trend")
async def analytics_stock_trend(symbol: str = Query(..., min_length=1), days: int = Query(5, ge=1, le=90)):
    """Return per-day trend for the last N days: Close, AVWAP, Diff %, Volume Ratio."""
    try:
        import yfinance as yf
        import pandas as pd
        from core.config import settings
        from datetime import datetime

        sym = symbol
        # Prefer NSE suffix if not already present
        ticker = sym if sym.endswith('.NS') else f"{sym}.NS"
        # Fetch from anchor date to now to compute AVWAP correctly
        start = settings.AVWAP_ANCHOR_DATE
        end = datetime.now().strftime('%Y-%m-%d')
        data = yf.Ticker(ticker).history(start=start, end=end)
        if data is None or len(data) == 0:
            # Try without suffix
            data = yf.Ticker(sym).history(start=start, end=end)
        if data is None or len(data) == 0:
            return { 'symbol': sym, 'series': [] }

        # Compute AVWAP series
        tp = (data['High'] + data['Low'] + data['Close']) / 3
        vol = data['Volume']
        cum_vp = (tp * vol).cumsum()
        cum_vol = vol.cumsum()
        avwap_series = (cum_vp / cum_vol)

        # Volume ratio vs 20D average
        vol_avg20 = vol.rolling(20).mean()
        vol_ratio = vol / vol_avg20

        df = pd.DataFrame({
            'Close': data['Close'],
            'AVWAP': avwap_series,
            'Volume': vol,
            'Volume_Ratio': vol_ratio,
        })
        df['Diff_Pct'] = (df['Close'] - df['AVWAP']) / df['AVWAP']
        df = df.dropna()
        df = df.tail(days)

        series = [
            {
                'date': idx.strftime('%Y-%m-%d'),
                'close': round(float(row['Close']), 4),
                'avwap': round(float(row['AVWAP']), 4),
                'diff_pct': round(float(row['Diff_Pct']), 6),
                'volume': int(row['Volume']),
                'volume_ratio': round(float(row['Volume_Ratio']), 4) if pd.notna(row['Volume_Ratio']) else None,
            }
            for idx, row in df.iterrows()
        ]
        return { 'symbol': sym, 'series': series }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error computing stock trend: {str(e)}")


@api_router.delete("/scan/{scan_id}/records")
async def delete_scan_records(
    scan_id: int,
    current_user=Depends(get_current_user_from_access_token),
    _csrf: None = Depends(csrf_protect),
):
    """Delete a completed/failed scan and its results from the database"""
    try:
        # Prevent deleting active scans via this endpoint
        session = db_manager.get_session()
        try:
            scan = session.query(Scan).filter(Scan.id == scan_id).first()
            if not scan:
                raise HTTPException(status_code=404, detail="Scan not found")
            if scan.status == "running":
                raise HTTPException(status_code=400, detail="Scan is running; cancel it instead")
        finally:
            db_manager.close_session(session)

        result = db_manager.delete_scan(scan_id)
        return {"message": "Scan deleted", **result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting scan: {str(e)}")


@api_router.delete("/scan/{scan_id}")
async def cancel_scan(
    scan_id: int,
    current_user=Depends(get_current_user_from_access_token),
    _csrf: None = Depends(csrf_protect),
):
    """Cancel an active scan"""
    if scan_id in active_scans:
        scan_info = active_scans[scan_id]
        logger.info(f"Cancelling scan_id={scan_id}")
        scan_info['task'].cancel()
        del active_scans[scan_id]
        return {"message": "Scan cancelled successfully"}
    else:
        raise HTTPException(status_code=404, detail="Active scan not found")


# Stocks CRUD endpoints
@api_router.get("/stocks")
async def list_stocks(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    try:
        items = db_manager.list_stocks(limit=limit, offset=offset)
        # get total count for proper pagination
        session = db_manager.get_session()
        try:
            total = session.query(Stock).count()
        finally:
            db_manager.close_session(session)
        return {"items": items, "total": total}
    except Exception as e:
        logger.exception("Error listing stocks")
        raise HTTPException(status_code=500, detail=f"Error listing stocks: {str(e)}")

@api_router.post("/stocks")
async def create_stock(
    stock: StockCreate,
    current_user=Depends(get_current_user_from_access_token),
    _csrf: None = Depends(csrf_protect),
):
    try:
        stock_id = db_manager.create_stock(stock.dict())
        # Return the created record
        for it in db_manager.list_stocks(limit=100, offset=0):
            if it.get('id') == stock_id:
                return it
        return {"id": stock_id, **stock.dict()}
    except Exception as e:
        logger.exception("Error creating stock")
        raise HTTPException(status_code=500, detail=f"Error creating stock: {str(e)}")

@api_router.put("/stocks/{stock_id}")
async def update_stock(
    stock_id: int,
    stock: StockUpdate,
    current_user=Depends(get_current_user_from_access_token),
    _csrf: None = Depends(csrf_protect),
):
    try:
        ok = db_manager.update_stock(stock_id, {k: v for k, v in stock.dict().items() if v is not None})
        if not ok:
            raise HTTPException(status_code=404, detail="Stock not found")
        return {"message": "Stock updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error updating stock_id={stock_id}")
        raise HTTPException(status_code=500, detail=f"Error updating stock: {str(e)}")

@api_router.delete("/stocks/{stock_id}")
async def delete_stock(
    stock_id: int,
    current_user=Depends(get_current_user_from_access_token),
    _csrf: None = Depends(csrf_protect),
):
    try:
        ok = db_manager.delete_stock(stock_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Stock not found")
        return {"message": "Stock deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error deleting stock_id={stock_id}")
        raise HTTPException(status_code=500, detail=f"Error deleting stock: {str(e)}")


@api_router.get("/symbols")
async def get_available_symbols():
    """Get list of available symbols for scanning"""
    try:
        symbols = db_manager.get_active_symbols()
        return { "symbols": symbols, "count": len(symbols) }
    except Exception:
        logger.warning("Falling back to static symbols list")
        # Fallback to strategy config if DB fails
        from core.config import StrategyConfig
        fallback = [f"{symbol}.NS" for symbol in StrategyConfig.NSE_SYMBOLS]
        return { "symbols": fallback, "count": len(fallback) }
