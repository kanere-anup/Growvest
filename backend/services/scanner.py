"""
Optimized Stock Market Scanner with improved architecture and performance
"""
import asyncio
import aiohttp
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time
import warnings
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from loguru import logger
import json

from core.config import settings, StrategyConfig
from core.database import db_manager, Scan, ScanResult

warnings.filterwarnings('ignore')


@dataclass
class ScanConfig:
    """Configuration for a scan session"""
    strategies: List[str] = None
    symbols: List[str] = None
    max_concurrent: int = None
    timeout: int = None
    retry_attempts: int = None
    
    def __post_init__(self):
        if self.strategies is None:
            self.strategies = [name for name, config in StrategyConfig.STRATEGIES.items() if config['enabled']]
        if self.symbols is None:
            try:
                from core.database import db_manager
                symbols = db_manager.get_active_symbols()
                self.symbols = symbols if symbols else [f"{symbol}.NS" for symbol in StrategyConfig.NSE_SYMBOLS]
            except Exception:
                self.symbols = [f"{symbol}.NS" for symbol in StrategyConfig.NSE_SYMBOLS]
        if self.max_concurrent is None:
            self.max_concurrent = settings.MAX_CONCURRENT_REQUESTS
        if self.timeout is None:
            self.timeout = settings.REQUEST_TIMEOUT
        if self.retry_attempts is None:
            self.retry_attempts = settings.RETRY_ATTEMPTS


class OptimizedStockScanner:
    """Optimized stock scanner with improved performance and architecture"""
    
    def __init__(self, config: ScanConfig = None, scan_id: Optional[int] = None):
        self.config = config or ScanConfig()
        self.semaphore = None
        self.stock_data_cache = {}
        self.scan_id = scan_id
        
        # Logging is configured centrally; no per-class handlers here.
    
    async def fetch_stock_data(self, symbol: str, start_date: datetime, end_date: datetime) -> Optional[pd.DataFrame]:
        """Fetch stock data with retry logic and caching"""
        for attempt in range(self.config.retry_attempts):
            try:
                async with self.semaphore:
                    loop = asyncio.get_event_loop()
                    data = await loop.run_in_executor(
                        None,
                        self._fetch_yf_data,
                        symbol, start_date, end_date
                    )
                    if data is not None and len(data) > 0:
                        return data
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed for {symbol}: {e}")
                if attempt < self.config.retry_attempts - 1:
                    await asyncio.sleep(settings.RETRY_DELAY * (attempt + 1))
        
        logger.error(f"Failed to fetch data for {symbol} after {self.config.retry_attempts} attempts")
        return None
    
    def _fetch_yf_data(self, symbol: str, start_date: datetime, end_date: datetime) -> Optional[pd.DataFrame]:
        """Synchronous data fetching function"""
        try:
            stock = yf.Ticker(symbol)
            data = stock.history(start=start_date, end=end_date)
            return data if len(data) > 0 else None
        except Exception as e:
            logger.error(f"Error fetching data for {symbol}: {e}")
            return None
    
    def calculate_avwap(self, data: pd.DataFrame, anchor_date: str) -> Optional[float]:
        """Calculate Anchored Volume Weighted Average Price"""
        try:
            anchor_data = data[data.index >= anchor_date].copy()
            if len(anchor_data) == 0:
                return None
            
            # Vectorized calculations
            typical_price = (anchor_data['High'] + anchor_data['Low'] + anchor_data['Close']) / 3
            volume_price = typical_price * anchor_data['Volume']
            
            cum_volume_price = volume_price.cumsum()
            cum_volume = anchor_data['Volume'].cumsum()
            
            return cum_volume_price.iloc[-1] / cum_volume.iloc[-1]
        except Exception as e:
            logger.error(f"Error calculating AVWAP: {e}")
            return None
    
    def calculate_52week_metrics(self, data: pd.DataFrame) -> Optional[Dict[str, Any]]:
        """Calculate 52-week high/low metrics"""
        try:
            recent_data = data.tail(252) if len(data) >= 252 else data
            if len(recent_data) == 0:
                return None
            
            week_52_high = recent_data['High'].max()
            week_52_low = recent_data['Low'].min()
            current_price = data['Close'].iloc[-1]
            
            distance_from_high = ((current_price - week_52_high) / week_52_high) * 100
            distance_from_low = ((current_price - week_52_low) / week_52_low) * 100
            
            high_date = recent_data[recent_data['High'] == week_52_high].index[-1].strftime('%Y-%m-%d')
            low_date = recent_data[recent_data['Low'] == week_52_low].index[-1].strftime('%Y-%m-%d')
            
            return {
                '52_week_high': week_52_high,
                '52_week_low': week_52_low,
                'distance_from_high_%': distance_from_high,
                'distance_from_low_%': distance_from_low,
                'high_date': high_date,
                'low_date': low_date,
                'current_price': current_price
            }
        except Exception as e:
            logger.error(f"Error calculating 52-week metrics: {e}")
            return None
    
    def strategy_avwap_proximity(self, data: pd.DataFrame, symbol: str) -> Optional[Dict[str, Any]]:
        """AVWAP Proximity Strategy"""
        try:
            avwap = self.calculate_avwap(data, settings.AVWAP_ANCHOR_DATE)
            if avwap is None:
                return None
            
            current_price = data['Close'].iloc[-1]
            price_diff = ((current_price - avwap) / avwap) * 100
            
            if abs(price_diff) <= (settings.AVWAP_TOLERANCE * 100):
                return {
                    'strategy_name': 'avwap_proximity',
                    'symbol': symbol.replace('.NS', ''),
                    'current_price': round(current_price, 2),
                    'result_data': {
                        'AVWAP': round(avwap, 2),
                        'Difference_%': round(price_diff, 2),
                        'Volume_Latest': int(data['Volume'].iloc[-1]),
                        'Date_Latest': data.index[-1].strftime('%Y-%m-%d')
                    },
                    'score': abs(price_diff)  # Lower is better
                }
        except Exception as e:
            logger.error(f"Error in AVWAP strategy for {symbol}: {e}")
        return None
    
    def strategy_52week_extremes(self, data: pd.DataFrame, symbol: str) -> Optional[Dict[str, Any]]:
        """52-Week Extremes Strategy"""
        try:
            metrics = self.calculate_52week_metrics(data)
            if metrics is None:
                return None
            
            near_high = abs(metrics['distance_from_high_%']) <= settings.WEEK_52_THRESHOLD
            near_low = abs(metrics['distance_from_low_%']) <= settings.WEEK_52_THRESHOLD
            
            if near_high or near_low:
                extreme_type = []
                if near_high:
                    extreme_type.append("52W High")
                if near_low:
                    extreme_type.append("52W Low")
                
                return {
                    'strategy_name': 'week_52_extremes',
                    'symbol': symbol.replace('.NS', ''),
                    'current_price': round(metrics['current_price'], 2),
                    'result_data': {
                        '52W_High': round(metrics['52_week_high'], 2),
                        '52W_Low': round(metrics['52_week_low'], 2),
                        'Distance_From_High_%': round(metrics['distance_from_high_%'], 2),
                        'Distance_From_Low_%': round(metrics['distance_from_low_%'], 2),
                        'High_Date': metrics['high_date'],
                        'Low_Date': metrics['low_date'],
                        'Extreme_Type': ' & '.join(extreme_type),
                        'Volume_Latest': int(data['Volume'].iloc[-1]),
                        'Date_Latest': data.index[-1].strftime('%Y-%m-%d')
                    },
                    'score': min(abs(metrics['distance_from_high_%']), abs(metrics['distance_from_low_%']))
                }
        except Exception as e:
            logger.error(f"Error in 52-week strategy for {symbol}: {e}")
        return None
    
    def strategy_volume_breakout(self, data: pd.DataFrame, symbol: str) -> Optional[Dict[str, Any]]:
        """Volume Breakout Strategy"""
        try:
            if len(data) < 20:
                return None
            
            avg_volume_20d = data['Volume'].tail(20).mean()
            current_volume = data['Volume'].iloc[-1]
            current_price = data['Close'].iloc[-1]
            
            if current_volume >= (avg_volume_20d * settings.VOLUME_BREAKOUT_MULTIPLIER):
                prev_close = data['Close'].iloc[-2]
                price_change = ((current_price - prev_close) / prev_close) * 100
                
                return {
                    'strategy_name': 'volume_breakout',
                    'symbol': symbol.replace('.NS', ''),
                    'current_price': round(current_price, 2),
                    'result_data': {
                        'Current_Volume': int(current_volume),
                        'Avg_Volume_20D': int(avg_volume_20d),
                        'Volume_Ratio': round(current_volume / avg_volume_20d, 2),
                        'Price_Change_%': round(price_change, 2),
                        'Date_Latest': data.index[-1].strftime('%Y-%m-%d'),
                        'Breakout_Type': 'Up' if price_change > 0 else 'Down'
                    },
                    'score': current_volume / avg_volume_20d  # Higher is better
                }
        except Exception as e:
            logger.error(f"Error in volume breakout strategy for {symbol}: {e}")
        return None
    
    def strategy_momentum(self, data: pd.DataFrame, symbol: str) -> Optional[Dict[str, Any]]:
        """Momentum Strategy"""
        try:
            if len(data) < 50:
                return None
            
            current_price = data['Close'].iloc[-1]
            
            # Calculate returns
            price_5d_ago = data['Close'].iloc[-6]
            price_10d_ago = data['Close'].iloc[-11]
            price_20d_ago = data['Close'].iloc[-21]
            
            return_5d = ((current_price - price_5d_ago) / price_5d_ago) * 100
            return_10d = ((current_price - price_10d_ago) / price_10d_ago) * 100
            return_20d = ((current_price - price_20d_ago) / price_20d_ago) * 100
            
            # Check momentum criteria
            strong_momentum = (
                return_5d > settings.MOMENTUM_5D_THRESHOLD and
                return_10d > settings.MOMENTUM_10D_THRESHOLD and
                return_20d > settings.MOMENTUM_20D_THRESHOLD
            )
            
            if strong_momentum:
                momentum_score = (return_5d + return_10d + return_20d) / 3
                return {
                    'strategy_name': 'momentum',
                    'symbol': symbol.replace('.NS', ''),
                    'current_price': round(current_price, 2),
                    'result_data': {
                        'Return_5D_%': round(return_5d, 2),
                        'Return_10D_%': round(return_10d, 2),
                        'Return_20D_%': round(return_20d, 2),
                        'Momentum_Score': round(momentum_score, 2),
                        'Volume_Latest': int(data['Volume'].iloc[-1]),
                        'Date_Latest': data.index[-1].strftime('%Y-%m-%d')
                    },
                    'score': momentum_score
                }
        except Exception as e:
            logger.error(f"Error in momentum strategy for {symbol}: {e}")
        return None
    
    async def process_stock(self, symbol: str, start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """Process a single stock through all enabled strategies"""
        results = []
        
        try:
            # Fetch data
            data = await self.fetch_stock_data(symbol, start_date, end_date)
            if data is None or len(data) == 0:
                return results
            
            # Run each strategy
            strategy_methods = {
                'avwap_proximity': self.strategy_avwap_proximity,
                'week_52_extremes': self.strategy_52week_extremes,
                'volume_breakout': self.strategy_volume_breakout,
                'momentum': self.strategy_momentum
            }
            
            for strategy_name in self.config.strategies:
                if strategy_name in strategy_methods:
                    try:
                        result = strategy_methods[strategy_name](data, symbol)
                        if result:
                            results.append(result)
                    except Exception as e:
                        logger.error(f"Error in {strategy_name} for {symbol}: {e}")
            
        except Exception as e:
            logger.error(f"Error processing {symbol}: {e}")
        
        return results
    
    async def run_scan(self) -> Dict[str, Any]:
        """Run the complete scan process"""
        logger.info("Starting optimized stock scan...")
        start_time = time.time()
        
        # Initialize semaphore
        self.semaphore = asyncio.Semaphore(self.config.max_concurrent)
        
        # Create or update scan record
        if self.scan_id is None:
            scan_data = {
                'status': 'running',
                'total_stocks': len(self.config.symbols),
                'successful_stocks': 0,
                'failed_stocks': 0,
                'strategies_run': json.dumps(self.config.strategies)
            }
            self.scan_id = db_manager.save_scan(scan_data)
        else:
            # Ensure existing scan is marked running with current parameters
            db_manager.update_scan(
                self.scan_id,
                status='running',
                total_stocks=len(self.config.symbols),
                strategies_run=json.dumps(self.config.strategies)
            )
        
        # Set date range
        end_date = datetime.now()
        start_date = datetime.strptime(settings.AVWAP_ANCHOR_DATE, "%Y-%m-%d") - timedelta(days=30)
        
        all_results = []
        successful_stocks = 0
        failed_stocks = 0
        
        try:
            # Process stocks in batches
            batch_size = 20
            for i in range(0, len(self.config.symbols), batch_size):
                batch_symbols = self.config.symbols[i:i + batch_size]
                
                # Create tasks for batch
                tasks = [
                    self.process_stock(symbol, start_date, end_date)
                    for symbol in batch_symbols
                ]
                
                # Process batch
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Process results
                for symbol, result in zip(batch_symbols, batch_results):
                    if isinstance(result, Exception):
                        logger.error(f"Error processing {symbol}: {result}")
                        failed_stocks += 1
                    else:
                        if result:  # Has results
                            all_results.extend(result)
                            successful_stocks += 1
                        else:
                            failed_stocks += 1
                
                # Update progress
                progress = ((i + len(batch_symbols)) / len(self.config.symbols)) * 100
                elapsed = time.time() - start_time
                logger.info(f"Progress: {progress:.1f}% - Elapsed: {elapsed:.1f}s - Results: {len(all_results)}")
            
            # Save results to database
            if all_results:
                db_manager.save_scan_results(self.scan_id, all_results)
            
            # Update scan status
            execution_time = time.time() - start_time
            results_summary = {
                'total_results': len(all_results),
                'results_by_strategy': {}
            }
            
            for strategy in self.config.strategies:
                strategy_results = [r for r in all_results if r['strategy_name'] == strategy]
                results_summary['results_by_strategy'][strategy] = len(strategy_results)
            
            db_manager.update_scan(
                self.scan_id,
                status='completed',
                successful_stocks=successful_stocks,
                failed_stocks=failed_stocks,
                execution_time=execution_time,
                results_summary=json.dumps(results_summary),
                completed_at=datetime.utcnow()
            )
            
            logger.info(f"Scan completed in {execution_time:.1f}s - Found {len(all_results)} results")
            
            return {
                'scan_id': self.scan_id,
                'execution_time': execution_time,
                'total_results': len(all_results),
                'successful_stocks': successful_stocks,
                'failed_stocks': failed_stocks,
                'results_by_strategy': results_summary['results_by_strategy']
            }
            
        except Exception as e:
            logger.error(f"Scan failed: {e}")
            db_manager.update_scan(self.scan_id, status='failed')
            raise


# Convenience function for running scans
async def run_scan(strategies: List[str] = None, symbols: List[str] = None, scan_id: Optional[int] = None) -> Dict[str, Any]:
    """Run a stock scan with specified parameters"""
    config = ScanConfig(strategies=strategies, symbols=symbols)
    scanner = OptimizedStockScanner(config, scan_id=scan_id)
    return await scanner.run_scan()
