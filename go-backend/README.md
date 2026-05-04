# Growvest Stock Screener - Backend

A production-ready stock market screener and analysis platform built with Go.

## Tech Stack

- **Language**: Go 1.22+
- **Framework**: Gin (HTTP router)
- **Database**: PostgreSQL
- **ORM**: GORM
- **Authentication**: JWT (access + refresh tokens)
- **Password Hashing**: bcrypt

## Project Structure

```
go-backend/
├── cmd/
│   └── api/
│       └── main.go              # Application entry point
├── internal/
│   ├── auth/                    # Authentication (JWT, password)
│   ├── config/                  # Configuration management
│   ├── database/                # Database connection & migrations
│   ├── handlers/                # HTTP handlers
│   ├── middleware/              # HTTP middleware
│   ├── models/                  # GORM models
│   ├── repository/              # Data access layer
│   └── services/
│       └── strategies/          # Strategy engine
├── migrations/                  # SQL migrations
├── pkg/                         # Shared utilities
├── .env.example                 # Environment variables template
├── go.mod                       # Go modules
├── Makefile                     # Build commands
└── README.md
```

## Quick Start

### Prerequisites

- Go 1.22+
- PostgreSQL 14+
- Make (optional)

### Setup

1. **Clone and navigate to the project**
   ```bash
   cd go-backend
   ```

2. **Install dependencies**
   ```bash
   make deps
   # or
   go mod download
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Create PostgreSQL database**
   ```sql
   CREATE DATABASE growvest_db;
   CREATE USER growvest WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE growvest_db TO growvest;
   ```

5. **Run the application**
   ```bash
   make run
   # or
   go run ./cmd/api/main.go
   ```

The API will be available at `http://localhost:8080`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login, returns JWT in cookies |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Revoke refresh token |
| GET | `/api/v1/auth/me` | Get current user |

### Stocks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/stocks` | List stocks (paginated) |
| POST | `/api/v1/stocks` | Create stock |
| GET | `/api/v1/stocks/:id` | Get stock by ID |
| PUT | `/api/v1/stocks/:id` | Update stock |
| DELETE | `/api/v1/stocks/:id` | Delete stock |
| GET | `/api/v1/my-stocks` | User's watchlist |
| POST | `/api/v1/my-stocks` | Add to watchlist |
| DELETE | `/api/v1/my-stocks/:id` | Remove from watchlist |

### Strategies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/strategies` | List available strategies |
| GET | `/api/v1/strategies/:id` | Get strategy details |
| GET | `/api/v1/my-strategies` | User's configured strategies |
| POST | `/api/v1/my-strategies` | Configure strategy for user |
| PUT | `/api/v1/my-strategies/:id` | Update configuration |
| DELETE | `/api/v1/my-strategies/:id` | Remove configuration |

### Scans
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/scans` | Start new scan |
| GET | `/api/v1/scans` | List user's scans |
| GET | `/api/v1/scans/:id` | Get scan details |
| GET | `/api/v1/scans/:id/status` | Get scan status |
| GET | `/api/v1/scans/:id/results` | Get scan results |
| DELETE | `/api/v1/scans/:id` | Delete scan |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/performance` | Strategy performance stats |
| GET | `/api/v1/analytics/top-stocks` | Top performing stocks |

## Authentication

The API uses JWT-based authentication with:
- **Access Token**: Short-lived (15 minutes), stored in HttpOnly cookie
- **Refresh Token**: Long-lived (7 days), stored in HttpOnly cookie
- **CSRF Token**: Double-submit cookie pattern for state-changing requests

### CSRF Protection

For POST/PUT/PATCH/DELETE requests, include the CSRF token in the header:
```
X-CSRF-Token: <value from csrf_token cookie>
```

## Available Strategies

1. **AVWAP Proximity** - Stocks near Anchored VWAP
2. **52-Week Extremes** - Stocks near 52-week high/low
3. **Volume Breakout** - High volume spikes
4. **Momentum** - Strong recent performance

## Development

### Run with hot reload
```bash
# Install air: go install github.com/cosmtrek/air@latest
make dev
```

### Run tests
```bash
make test
```

### Lint code
```bash
# Install golangci-lint first
make lint
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | HTTP server port | 8080 |
| `GIN_MODE` | Gin mode (debug/release) | debug |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_USER` | PostgreSQL user | growvest |
| `DB_PASSWORD` | PostgreSQL password | - |
| `DB_NAME` | PostgreSQL database | growvest_db |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_ACCESS_EXPIRY_MINUTES` | Access token expiry | 15 |
| `JWT_REFRESH_EXPIRY_DAYS` | Refresh token expiry | 7 |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | http://localhost:3000 |

## License

MIT License

