# Growvest - Stock Market Screener & Backtesting Platform

A full-stack stock market screening and backtesting platform for NSE (National Stock Exchange of India) stocks. Built with Go backend and React frontend.

## What This Project Does

- **Stock Universe Management** - Tracks ~174 NSE stocks (Nifty 50, Nifty Next 50, Nifty Midcap 100) with automatic daily refresh from Yahoo Finance
- **Technical Screening** - Runs 11 technical analysis strategies (RSI, MACD, Bollinger Bands, EMA Crossover, Volume Breakout, Momentum, VWAP, OBV, Mean Reversion, 52-Week Extremes, AVWAP Proximity)
- **Backtesting Engine** - Test any strategy against historical data with equity curves, trade logs, and performance metrics (Sharpe ratio, max drawdown, win rate)
- **Interactive Charts** - Candlestick + volume charts with historical OHLCV data from Yahoo Finance
- **Strategy Composer** - Visual pipeline builder to combine multiple strategies
- **Analytics Dashboard** - Performance metrics, top stocks, strategy comparison
- **User System** - JWT auth with refresh token rotation, Google OAuth, email verification, role-based access (user/admin)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Go 1.23+, Gin framework, GORM |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, React Query |
| **Database** | PostgreSQL 15+ |
| **Cache** | Redis (optional - app works without it) |
| **Market Data** | Yahoo Finance v8 API (free, no API key needed) |
| **Auth** | JWT (access + refresh tokens), CSRF double-submit, Google OAuth2 |

## Project Structure

```
Growvest/
├── project/
│   ├── go-backend/           # Go API server
│   │   ├── cmd/api/          # Entry point (main.go)
│   │   ├── internal/
│   │   │   ├── auth/         # JWT & password hashing
│   │   │   ├── config/       # Environment config loading
│   │   │   ├── database/     # PostgreSQL connection, migrations, seeds
│   │   │   ├── handlers/     # HTTP handlers (auth, stocks, scans, backtest, chart)
│   │   │   ├── middleware/    # Auth, CORS, rate limit, CSRF, logging
│   │   │   ├── models/       # GORM models (User, Stock, Strategy, Scan, etc.)
│   │   │   ├── repository/   # Database queries
│   │   │   └── services/
│   │   │       ├── backtest/     # Backtesting engine
│   │   │       ├── cache/        # Redis cache wrapper
│   │   │       ├── marketdata/   # Yahoo Finance & NSE data fetcher
│   │   │       ├── scanner/      # Scan executor (concurrent workers)
│   │   │       ├── stocksync/    # Daily stock sync scheduler
│   │   │       ├── strategies/   # 11 technical analysis strategies
│   │   │       └── websocket/    # WebSocket hub for scan progress
│   │   ├── pkg/logger/       # Structured logging (zerolog)
│   │   ├── data/             # Seed data (stocks.json)
│   │   └── migrations/       # SQL migrations
│   │
│   ├── react-frontend/       # React SPA
│   │   ├── src/
│   │   │   ├── components/   # UI components (Header, StockSearch, etc.)
│   │   │   ├── context/      # Auth & Theme providers
│   │   │   ├── pages/        # Route pages (Dashboard, Stocks, Backtest, etc.)
│   │   │   ├── services/     # API client (axios)
│   │   │   ├── styles/       # Global CSS + Tailwind theme
│   │   │   └── types/        # TypeScript interfaces
│   │   └── public/           # Static assets
│   │
│   ├── docker-compose.yml    # PostgreSQL + Redis + Prometheus
│   └── prometheus.yml        # Metrics config
│
├── study/                    # Learning resources & notes
├── backend/                  # (Legacy - older version)
├── frontend/                 # (Legacy - older version)
└── README.md                 # This file
```

## Prerequisites

- **Go** 1.23 or later - [install](https://go.dev/dl/)
- **Node.js** 18+ and npm - [install](https://nodejs.org/)
- **PostgreSQL** 15+ - [install](https://www.postgresql.org/download/)
- **Redis** (optional) - [install](https://redis.io/download/)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/kanere-anup/Growvest.git
cd Growvest/project
```

### 2. Set Up PostgreSQL Database

```bash
# Create the database and user
psql -U postgres
CREATE USER growvest WITH PASSWORD 'your_password';
CREATE DATABASE growvest_db OWNER growvest;
\q
```

Or use Docker (recommended):

```bash
docker-compose up -d postgres redis
```

### 3. Start the Go Backend

```bash
cd go-backend

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your database credentials and a secure JWT secret

# Install Go dependencies
go mod download

# Build and run
go build -o ./bin/api ./cmd/api
./bin/api
```

The API server starts on **http://localhost:8080**

On startup, it will:
- Auto-migrate the database schema
- Seed 11 default strategies
- Seed initial stock data from `data/stocks.json`
- Start the daily stock sync scheduler (syncs ~174 NSE stocks from Yahoo Finance)

### 4. Start the React Frontend

```bash
cd react-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend starts on **http://localhost:5173**

### 5. Create Your Account

1. Open http://localhost:5173
2. Click "Register" and create an account
3. Login with your credentials

**To get admin access** (for stock sync, managing stocks):
```sql
-- Run in PostgreSQL
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

## Docker Setup (Alternative)

Run the full stack with Docker:

```bash
cd project

# Start PostgreSQL + Redis + Prometheus
docker-compose up -d

# Then start backend and frontend manually (see steps 3 & 4 above)
```

## API Endpoints

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh JWT token |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/google` | Google OAuth login |
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI |

### Protected (requires JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/stocks` | List all stocks (paginated, filterable) |
| GET | `/api/v1/stocks/:id` | Get stock by ID |
| GET | `/api/v1/strategies` | List all strategies |
| POST | `/api/v1/scans` | Start a new scan |
| GET | `/api/v1/scans` | List scan history |
| GET | `/api/v1/scans/:id/results` | Get scan results |
| POST | `/api/v1/backtest/run` | Run backtest |
| GET | `/api/v1/chart/data` | Get OHLCV chart data |
| GET | `/api/v1/analytics/performance` | Strategy performance |
| GET | `/api/v1/analytics/top-stocks` | Top performing stocks |
| GET/POST/DELETE | `/api/v1/my-stocks` | Watchlist management |
| GET/POST/PUT/DELETE | `/api/v1/my-strategies` | User strategy config |

### Admin Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/admin/stocks/sync` | Trigger stock sync from Yahoo Finance |
| GET | `/api/v1/admin/stocks/sync/status` | Check sync status |
| POST/PUT/DELETE | `/api/v1/admin/stocks` | CRUD stocks |

## Available Strategies

| # | Strategy | Signal Type | Description |
|---|----------|-------------|-------------|
| 1 | RSI | Overbought/Oversold | RSI > 70 (sell) or RSI < 30 (buy) |
| 2 | MACD Crossover | Trend | MACD line crosses signal line |
| 3 | Bollinger Bands | Volatility | Price touches upper/lower bands |
| 4 | EMA/SMA Crossover | Trend | Golden cross / death cross |
| 5 | Volume Breakout | Volume | Volume > 2x 20-day average |
| 6 | Momentum | Trend | Multi-timeframe momentum (5/10/20 day) |
| 7 | 52-Week Extremes | Range | Price within 2% of 52-week high/low |
| 8 | VWAP | Intraday | Price near Volume Weighted Average Price |
| 9 | OBV | Volume | On Balance Volume divergence |
| 10 | Mean Reversion | Statistical | Z-score from moving average |
| 11 | AVWAP Proximity | Anchored VWAP | Price near Anchored VWAP |

## Stock Sync

The app automatically syncs ~174 NSE stocks from Yahoo Finance:

- **Nifty 50** (50 large-cap stocks)
- **Nifty Next 50** (50 large-cap stocks)
- **Nifty Midcap 100** (75 mid-cap stocks)

**How it works:**
1. On server startup, a scheduled sync runs after 30 seconds
2. Then repeats every 24 hours automatically
3. Uses Yahoo Finance v8 chart API (free, no API key)
4. Fetches: company name, last price, 52-week high/low, volume
5. Sector & industry data from curated static mappings
6. Stocks removed from indices are flagged as "possibly delisted"
7. Admin can also trigger manual sync from the UI

## Environment Variables

### Backend (`project/go-backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | localhost | PostgreSQL host |
| `DB_PORT` | Yes | 5432 | PostgreSQL port |
| `DB_USER` | Yes | growvest | Database user |
| `DB_PASSWORD` | Yes | - | Database password |
| `DB_NAME` | Yes | growvest_db | Database name |
| `JWT_SECRET` | Yes | - | JWT signing key (min 32 chars) |
| `REDIS_ADDR` | No | localhost:6379 | Redis address |
| `CORS_ALLOWED_ORIGINS` | No | localhost:3000,5173 | Allowed CORS origins |
| `SERVER_PORT` | No | 8080 | API server port |
| `GOOGLE_CLIENT_ID` | No | - | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | - | Google OAuth secret |

### Frontend

The frontend uses `VITE_API_URL` (defaults to `/api/v1` which proxies to the backend via Vite dev server).

## Development

```bash
# Backend - run with hot reload (using air)
cd project/go-backend
go install github.com/air-verse/air@latest
air

# Frontend - already has hot reload
cd project/react-frontend
npm run dev

# Build frontend for production
npm run build
```

## Screenshots

The application features:
- Dark/Light theme toggle
- Responsive design (mobile + desktop)
- Interactive candlestick charts
- Real-time scan progress via WebSocket
- Grid and list views for stocks
- 52-week range visualization on stock cards

## License

This project is for educational and personal use.

---

Built by [Anup Kanere](https://github.com/kanere-anup)
