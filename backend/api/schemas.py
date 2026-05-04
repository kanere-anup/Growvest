"""
Pydantic schemas for API request/response models
"""
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime


class ScanRequest(BaseModel):
    """Request model for starting a scan"""
    strategies: Optional[List[str]] = None
    symbols: Optional[List[str]] = None
    max_concurrent: Optional[int] = None
    timeout: Optional[int] = None


class ScanResponse(BaseModel):
    """Response model for scan start"""
    scan_id: int
    status: str
    message: str


class ScanStatus(BaseModel):
    """Model for scan status"""
    scan_id: int
    status: str
    total_stocks: int
    successful_stocks: int
    failed_stocks: int
    execution_time: float
    strategies_run: List[str]
    results_summary: Dict[str, Any]
    created_at: datetime
    completed_at: Optional[datetime] = None


class ScanResult(BaseModel):
    """Model for individual scan result"""
    id: int
    strategy_name: str
    symbol: str
    current_price: float
    result_data: Dict[str, Any]
    score: Optional[float]
    created_at: datetime


class StrategyInfo(BaseModel):
    """Model for strategy information"""
    name: str
    display_name: str
    description: str
    enabled: bool
    priority: int


# Stocks CRUD schemas
class StockBase(BaseModel):
    symbol: str
    name: Optional[str] = None
    sector: Optional[str] = None
    market_cap: Optional[float] = None
    is_active: bool = True

class StockCreate(StockBase):
    pass

class StockUpdate(BaseModel):
    symbol: Optional[str] = None
    name: Optional[str] = None
    sector: Optional[str] = None
    market_cap: Optional[float] = None
    is_active: Optional[bool] = None

class StockOut(StockBase):
    id: int
    created_at: datetime
    updated_at: datetime
