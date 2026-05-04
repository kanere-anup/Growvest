# Stock Market Scanner

An advanced, production-ready stock market scanner with multiple strategies, file-based database, and modern web UI.

## Features

### 🎯 Multiple Scanning Strategies
- **AVWAP Proximity**: Find stocks trading within ±5% of Anchored Volume Weighted Average Price
- **52-Week Extremes**: Identify stocks near 52-week high or low (within 2%)
- **Volume Breakout**: Detect stocks with volume 2x+ above 20-day average
- **Momentum**: Find stocks with strong recent performance across timeframes

### 🚀 Performance Optimizations
- **Async Processing**: Concurrent stock data fetching with rate limiting
- **Caching**: Intelligent data caching to reduce API calls
- **Batch Processing**: Efficient batch processing of stocks
- **Retry Logic**: Robust error handling with exponential backoff

### 💾 File-Based Database
- **SQLite Database**: Lightweight, serverless database for storing results
- **Historical Data**: Store and analyze historical scan results
- **Export Functionality**: Excel export with multiple sheets
- **Data Retention**: Configurable data cleanup policies

### 🎨 Modern Web UI
- **React Frontend**: Modern, responsive user interface
- **Real-time Updates**: Live scan progress and status updates
- **Interactive Charts**: Visual analytics and performance metrics
- **Export Capabilities**: Download results in Excel format

### 🔧 Production Ready
- **FastAPI Backend**: High-performance async API
- **Configuration Management**: Environment-based configuration
- **Logging**: Comprehensive logging with rotation
- **Error Handling**: Robust error handling and recovery

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stockMarketScripts
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Initialize the database**
   ```bash
   python -c "from database import db_manager; db_manager.create_tables()"
   ```

### Running the Application

1. **Start the backend API**
   ```bash
   python api.py
   ```
   The API will be available at `http://localhost:8000`

2. **Start the frontend (in a new terminal)**
   ```bash
   cd frontend
   npm start
   ```
   The UI will be available at `http://localhost:3000`

3. **Access the application**
   - Web UI: `http://localhost:3000`
   - API Documentation: `http://localhost:8000/docs`
   - Health Check: `http://localhost:8000/health`

## Usage

### Web Interface

1. **Dashboard**: Overview of strategies and recent scans
2. **Start Scan**: Configure and start new scans
3. **View Results**: Detailed results with filtering and export
4. **Analytics**: Performance metrics and strategy analysis

### API Usage

#### Start a Scan
```bash
curl -X POST "http://localhost:8000/scan" \
  -H "Content-Type: application/json" \
  -d '{
    "strategies": ["avwap_proximity", "volume_breakout"],
    "max_concurrent": 10
  }'
```

#### Get Scan Results
```bash
curl "http://localhost:8000/scan/1/results"
```

#### Export Results
```bash
curl "http://localhost:8000/scan/1/export" -o results.xlsx
```

### Python API

```python
from scanner import run_scan

# Run a scan with specific strategies
result = await run_scan(
    strategies=['avwap_proximity', 'momentum'],
    symbols=['RELIANCE.NS', 'TCS.NS']
)

print(f"Scan completed: {result}")
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `sqlite:///./stock_scanner.db` |
| `API_HOST` | API host address | `0.0.0.0` |
| `API_PORT` | API port | `8000` |
| `MAX_CONCURRENT_REQUESTS` | Max concurrent API requests | `15` |
| `AVWAP_TOLERANCE` | AVWAP tolerance percentage | `0.05` (5%) |
| `LOG_LEVEL` | Logging level | `INFO` |

### Strategy Configuration

Edit `config.py` to customize strategy parameters:

```python
# AVWAP Strategy
avwap_tolerance = 0.05  # 5% tolerance
avwap_anchor_date = "2020-01-01"

# Volume Breakout Strategy
volume_breakout_multiplier = 2.0  # 2x average volume

# Momentum Strategy
momentum_5d_threshold = 3.0   # 3% in 5 days
momentum_10d_threshold = 5.0  # 5% in 10 days
momentum_20d_threshold = 10.0 # 10% in 20 days

# 52-Week Strategy
week_52_threshold = 2.0  # 2% from extremes
```

## Architecture

### Backend Components

- **`backend/app.py`**: Main FastAPI application entry point
- **`backend/core/config.py`**: Configuration management
- **`backend/core/database.py`**: Database models and operations
- **`backend/services/scanner.py`**: Optimized scanning engine
- **`backend/api/routes.py`**: API route handlers
- **`backend/api/schemas.py`**: Pydantic request/response models

### Frontend Components

- **`frontend/src/App.js`**: Main React application
- **`frontend/src/pages/`**: Page components (Dashboard, Scans, Results, Analytics)
- **`frontend/src/services/api.js`**: API service layer
- **`frontend/src/components/`**: Reusable UI components

### Database Schema

- **`scans`**: Scan sessions and metadata
- **`scan_results`**: Individual scan results
- **`strategies`**: Strategy configurations
- **`stocks`**: Stock information
- **`stock_data`**: Historical stock data

## Performance

### Optimizations Implemented

1. **Async Processing**: Non-blocking I/O for data fetching
2. **Rate Limiting**: Controlled concurrent requests to prevent API throttling
3. **Caching**: Intelligent caching of stock data
4. **Batch Processing**: Efficient batch processing of stocks
5. **Database Indexing**: Optimized database queries with proper indexing

### Benchmarks

- **Scan Speed**: ~100 stocks in 30-60 seconds
- **Memory Usage**: ~200MB for typical scans
- **Database Size**: ~1MB per 1000 scan results
- **API Response Time**: <100ms for most endpoints

## Monitoring and Logging

### Logging

Logs are written to `./logs/scanner.log` with rotation:
- Daily rotation
- 30-day retention
- Configurable log levels

### Health Monitoring

- Health check endpoint: `/health`
- Database connectivity monitoring
- API response time tracking

## Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   export DATABASE_URL="sqlite:///./data/production.db"
   export LOG_LEVEL="WARNING"
   export API_HOST="0.0.0.0"
   export API_PORT="8000"
   ```

2. **Build Frontend**
   ```bash
   cd frontend
   npm run build
   cd ..
   ```

3. **Start Production Server**
   ```bash
   uvicorn api:app --host 0.0.0.0 --port 8000 --workers 4
   ```

### Docker Deployment

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN cd frontend && npm install && npm run build

EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Troubleshooting

### Common Issues

1. **API Connection Errors**
   - Check if backend is running on correct port
   - Verify CORS settings for frontend

2. **Database Errors**
   - Ensure database directory exists
   - Check file permissions

3. **Scan Failures**
   - Check internet connectivity
   - Verify Yahoo Finance API access
   - Review rate limiting settings

### Debug Mode

Enable debug logging:
```bash
export LOG_LEVEL="DEBUG"
python api.py
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the API documentation at `/docs`

## Changelog

### v1.0.0
- Initial release
- Multiple scanning strategies
- File-based database
- Modern web UI
- Production-ready architecture
