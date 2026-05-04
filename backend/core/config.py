"""
Configuration management for the Stock Market Scanner
"""
import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings
from datetime import datetime, timedelta
import secrets


class Settings(BaseSettings):
    """Application settings"""
    
    # Database settings
    DATABASE_URL: str = "sqlite:///./stock_scanner.db"
    DATABASE_PATH: str = "./data/stock_scanner.db"
    
    # API settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_TITLE: str = "Stock Market Scanner API"
    API_VERSION: str = "1.0.0"

    # Auth/JWT settings
    SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRES_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRES_DAYS: int = 7
    ACCESS_TOKEN_COOKIE_NAME: str = "access_token"
    REFRESH_TOKEN_COOKIE_NAME: str = "refresh_token"
    CSRF_COOKIE_NAME: str = "csrf_token"

    # CORS
    CORS_ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000"
    ]
    
    # Scanner settings
    MAX_CONCURRENT_REQUESTS: int = 15
    REQUEST_TIMEOUT: int = 30
    RETRY_ATTEMPTS: int = 3
    RETRY_DELAY: float = 1.0
    
    # Strategy settings
    AVWAP_TOLERANCE: float = 0.05  # 5%
    AVWAP_ANCHOR_DATE: str = "2020-03-22"
    VOLUME_BREAKOUT_MULTIPLIER: float = 2.0
    MOMENTUM_5D_THRESHOLD: float = 3.0
    MOMENTUM_10D_THRESHOLD: float = 5.0
    MOMENTUM_20D_THRESHOLD: float = 10.0
    WEEK_52_THRESHOLD: float = 2.0  # 2%
    
    # Data settings
    DATA_RETENTION_DAYS: int = 365
    CACHE_TTL_HOURS: int = 1
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "./logs/scanner.log"
    
    # Frontend
    FRONTEND_BUILD_PATH: str = "../../Growvest-frontend/build"
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


class DatabaseConfig:
    """Database configuration"""
    
    # Table names
    SCANS_TABLE = "scans"
    STRATEGIES_TABLE = "strategies"
    RESULTS_TABLE = "scan_results"
    STOCKS_TABLE = "stocks"
    STOCK_DATA_TABLE = "stock_data"
    
    # Indexes for performance
    INDEXES = [
        "CREATE INDEX IF NOT EXISTS idx_scans_timestamp ON scans(timestamp)",
        "CREATE INDEX IF NOT EXISTS idx_results_scan_id ON scan_results(scan_id)",
        "CREATE INDEX IF NOT EXISTS idx_results_strategy ON scan_results(strategy_name)",
        "CREATE INDEX IF NOT EXISTS idx_stock_data_symbol ON stock_data(symbol)",
        "CREATE INDEX IF NOT EXISTS idx_stock_data_date ON stock_data(date)"
    ]


class StrategyConfig:
    """Strategy-specific configuration"""
    
    STRATEGIES = {
        "avwap_proximity": {
            "name": "AVWAP Proximity",
            "description": "Stocks trading within ±5% of Anchored Volume Weighted Average Price",
            "enabled": True,
            "priority": 1
        },
        "week_52_extremes": {
            "name": "52-Week Extremes",
            "description": "Stocks near 52-week high or low (within 2%)",
            "enabled": True,
            "priority": 2
        },
        "volume_breakout": {
            "name": "Volume Breakout",
            "description": "Stocks with volume 2x+ above 20-day average",
            "enabled": True,
            "priority": 3
        },
        "momentum": {
            "name": "Momentum Stocks",
            "description": "Stocks with strong recent performance across timeframes",
            "enabled": True,
            "priority": 4
        }
    }
    
    # NSE Stock symbols (expanded list)
    NSE_SYMBOLS = [
        # Nifty 50
        'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR',
        'ICICIBANK', 'KOTAKBANK', 'BHARTIARTL', 'ITC', 'SBIN',
        'LT', 'ASIANPAINT', 'AXISBANK', 'MARUTI', 'BAJFINANCE',
        'HCLTECH', 'WIPRO', 'ULTRACEMCO', 'ADANIPORTS', 'ONGC',
        'TATAMOTORS', 'SUNPHARMA', 'JSWSTEEL', 'TATASTEEL', 'POWERGRID',
        'NTPC', 'TECHM', 'TITAN', 'NESTLEIND', 'COALINDIA',
        'BAJAJFINSV', 'M&M', 'HDFCLIFE', 'GRASIM', 'DRREDDY',
        'BRITANNIA', 'EICHERMOT', 'BPCL', 'CIPLA', 'DIVISLAB',
        'HEROMOTOCO', 'BAJAJ-AUTO', 'TATACONSUM', 'INDUSINDBK', 'APOLLOHOSP',
        'LTIM', 'ADANIENT', 'HINDALCO', 'SHRIRAMFIN', 'PIDILITIND',
        
        # Additional popular stocks
        'VEDL', 'GODREJCP', 'DABUR', 'MARICO', 'COLPAL',
        'MCDOWELL-N', 'AMBUJACEM', 'ACC', 'GAIL', 'IOC',
        'BANKBARODA', 'PNB', 'CANBK', 'UNIONBANK', 'IDFCFIRSTB',
        'FEDERALBNK', 'RBLBANK', 'BANDHANBNK', 'AUBANK', 'INDIANB',
        'MOTHERSON', 'BOSCHLTD', 'BAJAJHLDNG', 'BERGEPAINT', 'PIDILITE',
        'PAGEIND', 'HAVELLS', 'VOLTAS', 'CROMPTON', 'WHIRLPOOL',
        'TORNTPHARM', 'LUPIN', 'BIOCON', 'CADILAHC', 'GLENMARK',
        'CONCOR', 'GMRINFRA', 'IRB', 'RAILTEL', 'IRCTC',
        'ZOMATO', 'NYKAA', 'PAYTM', 'POLICYBZR', 'DELHIVERY',
        'TRENT', 'DIXON', 'FLUOROCHEM', 'CLEAN', 'HAPPSTMNDS',
        'MINDTREE', 'PERSISTENT', 'COFORGE', 'MPHASIS', 'OFSS'
    ]


# Global settings instance
settings = Settings()

# Ensure data directories exist
def ensure_directories():
    """Create necessary directories"""
    directories = [
        # "./data",
        "logs", 
        "exports",
        # "./frontend/build"
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)

# Initialize directories on import
ensure_directories()
