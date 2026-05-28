# Growvest - Stock Market Screener Architecture

## Overview

This document describes the architecture of the Growvest stock market screener platform, built with **Go (Gin)** backend and **React (TypeScript)** frontend.

---

## Database Schema Design

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────┐
│   users     │──────<│  user_stocks    │>──────│    stocks    │
└─────────────┘       └─────────────────┘       └──────────────┘
       │                                               │
       │         ┌─────────────────┐                   │
       └────────<│ user_strategies │                   │
       │         └─────────────────┘                   │
       │                │                              │
       │                ▼                              │
       │         ┌─────────────────┐                   │
       │         │   strategies    │                   │
       │         └─────────────────┘                   │
       │                                               │
       ▼                                               │
┌─────────────┐       ┌─────────────────┐              │
│   scans     │──────<│  scan_stocks    │>─────────────┘
└─────────────┘       └─────────────────┘
       │
       ▼
┌─────────────────┐
│  scan_results   │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│    reports      │
└─────────────────┘
```

### Tables

#### 1. users
Primary user table with authentication data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| full_name | VARCHAR(255) | | User's full name |
| role | VARCHAR(50) | DEFAULT 'user' | Role: user, admin |
| is_active | BOOLEAN | DEFAULT true | Account status |
| is_verified | BOOLEAN | DEFAULT false | Email verification |
| created_at | TIMESTAMP | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL | Last update |
| deleted_at | TIMESTAMP | | Soft delete marker |

#### 2. refresh_sessions
JWT refresh token sessions for secure token rotation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| user_id | UUID | FK -> users.id | Owner |
| token_hash | VARCHAR(128) | UNIQUE, INDEX | SHA256 of refresh token |
| user_agent | VARCHAR(512) | | Browser/client info |
| ip_address | VARCHAR(64) | | Client IP |
| expires_at | TIMESTAMP | NOT NULL | Expiration time |
| revoked_at | TIMESTAMP | | Revocation time |
| replaced_by | VARCHAR(128) | | New token hash (rotation) |
| created_at | TIMESTAMP | NOT NULL | Creation timestamp |

#### 3. stocks
Master stock list (shared across users).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| symbol | VARCHAR(20) | UNIQUE, NOT NULL | Stock symbol (e.g., RELIANCE) |
| exchange | VARCHAR(20) | DEFAULT 'NSE' | Exchange code |
| name | VARCHAR(255) | | Company name |
| sector | VARCHAR(100) | | Industry sector |
| market_cap | DECIMAL(20,2) | | Market capitalization |
| is_active | BOOLEAN | DEFAULT true | Active for scanning |
| metadata | JSONB | | Additional metadata |
| created_at | TIMESTAMP | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL | Last update |
| deleted_at | TIMESTAMP | | Soft delete marker |

#### 4. user_stocks
User's personal stock watchlist (many-to-many).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| user_id | UUID | FK -> users.id, INDEX | Stock owner |
| stock_id | UUID | FK -> stocks.id | Stock reference |
| notes | TEXT | | User notes |
| is_favorite | BOOLEAN | DEFAULT false | Favorited stock |
| created_at | TIMESTAMP | NOT NULL | Added timestamp |
| | | UNIQUE(user_id, stock_id) | Prevent duplicates |

#### 5. strategies
Strategy definitions with configurable parameters.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Internal name |
| display_name | VARCHAR(200) | NOT NULL | UI display name |
| description | TEXT | | Strategy description |
| category | VARCHAR(50) | | Category: technical, fundamental |
| parameters | JSONB | | Default parameters |
| is_system | BOOLEAN | DEFAULT false | System-provided strategy |
| is_active | BOOLEAN | DEFAULT true | Available for use |
| created_by | UUID | FK -> users.id | Creator (null for system) |
| created_at | TIMESTAMP | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL | Last update |
| deleted_at | TIMESTAMP | | Soft delete marker |

#### 6. user_strategies
User's configured strategies with custom parameters.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| user_id | UUID | FK -> users.id, INDEX | Owner |
| strategy_id | UUID | FK -> strategies.id | Base strategy |
| custom_name | VARCHAR(200) | | User's custom name |
| parameters | JSONB | | Overridden parameters |
| is_enabled | BOOLEAN | DEFAULT true | Enabled for scans |
| priority | INTEGER | DEFAULT 0 | Execution priority |
| created_at | TIMESTAMP | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL | Last update |
| | | UNIQUE(user_id, strategy_id) | One config per strategy |

#### 7. scans
Scan execution sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| user_id | UUID | FK -> users.id, INDEX | Owner |
| name | VARCHAR(255) | | Optional scan name |
| status | VARCHAR(20) | NOT NULL | pending, running, completed, failed |
| total_stocks | INTEGER | DEFAULT 0 | Stocks to process |
| processed_stocks | INTEGER | DEFAULT 0 | Stocks processed |
| successful_stocks | INTEGER | DEFAULT 0 | Successfully analyzed |
| failed_stocks | INTEGER | DEFAULT 0 | Failed to analyze |
| execution_time_ms | INTEGER | | Execution duration |
| error_message | TEXT | | Error if failed |
| metadata | JSONB | | Additional info |
| started_at | TIMESTAMP | | Execution start |
| completed_at | TIMESTAMP | | Execution end |
| created_at | TIMESTAMP | NOT NULL | Creation timestamp |
| updated_at | TIMESTAMP | NOT NULL | Last update |

#### 8. scan_stocks
Stocks included in a specific scan (many-to-many).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| scan_id | UUID | FK -> scans.id, INDEX | Scan reference |
| stock_id | UUID | FK -> stocks.id | Stock reference |
| | | UNIQUE(scan_id, stock_id) | Prevent duplicates |

#### 9. scan_strategies
Strategies used in a specific scan.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| scan_id | UUID | FK -> scans.id, INDEX | Scan reference |
| user_strategy_id | UUID | FK -> user_strategies.id | Strategy config used |
| parameters_snapshot | JSONB | | Parameters at scan time |
| | | UNIQUE(scan_id, user_strategy_id) | Prevent duplicates |

#### 10. scan_results
Individual results from strategy execution.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| scan_id | UUID | FK -> scans.id, INDEX | Scan reference |
| stock_id | UUID | FK -> stocks.id, INDEX | Stock analyzed |
| strategy_id | UUID | FK -> strategies.id, INDEX | Strategy used |
| symbol | VARCHAR(20) | NOT NULL, INDEX | Denormalized for speed |
| current_price | DECIMAL(12,4) | | Price at analysis |
| result_data | JSONB | | Strategy-specific results |
| score | DECIMAL(10,4) | | Calculated score |
| signal | VARCHAR(20) | | buy, sell, hold, neutral |
| created_at | TIMESTAMP | NOT NULL, INDEX | Result timestamp |

#### 11. reports
Saved/exported analysis reports.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| user_id | UUID | FK -> users.id, INDEX | Owner |
| scan_id | UUID | FK -> scans.id | Source scan |
| name | VARCHAR(255) | NOT NULL | Report name |
| type | VARCHAR(50) | | Type: excel, pdf, summary |
| file_path | VARCHAR(512) | | Stored file path |
| file_size | INTEGER | | File size in bytes |
| metadata | JSONB | | Report metadata |
| created_at | TIMESTAMP | NOT NULL | Creation timestamp |
| expires_at | TIMESTAMP | | Auto-delete after |

---

## Backend Architecture

### Project Structure

```
go-backend/
├── cmd/
│   └── api/
│       └── main.go              # Application entry point
├── internal/
│   ├── auth/
│   │   ├── jwt.go               # JWT token generation/validation
│   │   └── password.go          # Password hashing with bcrypt
│   ├── config/
│   │   └── config.go            # Configuration from env
│   ├── database/
│   │   └── postgres.go          # Database connection
│   ├── handlers/
│   │   ├── auth.go              # Auth endpoints
│   │   ├── stocks.go            # Stock CRUD
│   │   ├── strategies.go        # Strategy management
│   │   ├── scans.go             # Scan operations
│   │   ├── reports.go           # Report generation
│   │   └── health.go            # Health check
│   ├── middleware/
│   │   ├── auth.go              # JWT auth middleware
│   │   ├── cors.go              # CORS configuration
│   │   ├── logger.go            # Request logging
│   │   └── recovery.go          # Panic recovery
│   ├── models/
│   │   └── models.go            # GORM models
│   ├── repository/
│   │   ├── user.go              # User data access
│   │   ├── stock.go             # Stock data access
│   │   ├── strategy.go          # Strategy data access
│   │   ├── scan.go              # Scan data access
│   │   └── report.go            # Report data access
│   └── services/
│       ├── user.go              # User business logic
│       ├── stock.go             # Stock business logic
│       ├── scan.go              # Scan orchestration
│       ├── report.go            # Report generation
│       └── strategies/
│           ├── interface.go     # Strategy interface
│           ├── registry.go      # Strategy registry
│           ├── avwap.go         # AVWAP Proximity
│           ├── week52.go        # 52-Week Extremes
│           ├── volume.go        # Volume Breakout
│           └── momentum.go      # Momentum
├── migrations/
│   ├── 001_initial.up.sql
│   └── 001_initial.down.sql
├── pkg/
│   ├── logger/
│   │   └── logger.go            # Structured logging
│   ├── utils/
│   │   └── helpers.go           # Utility functions
│   └── validator/
│       └── validator.go         # Custom validators
├── .env.example
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

### Clean Architecture Layers

```
┌──────────────────────────────────────────────────────────┐
│                    HTTP Handlers                          │
│  (Request parsing, response formatting, auth middleware)  │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                     Services                              │
│  (Business logic, validation, orchestration)              │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                   Repositories                            │
│  (Database access, query building, transactions)          │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                    Database                               │
│  (PostgreSQL with GORM)                                   │
└──────────────────────────────────────────────────────────┘
```

### Strategy Engine Design

The strategy engine uses the **Strategy Pattern** with a registry for pluggable strategies:

```go
// Strategy interface - all strategies implement this
type Strategy interface {
    Name() string
    Execute(ctx context.Context, data *StockData, params map[string]interface{}) (*StrategyResult, error)
    Validate(params map[string]interface{}) error
    DefaultParams() map[string]interface{}
}

// Registry holds all available strategies
type Registry struct {
    strategies map[string]Strategy
}

func (r *Registry) Register(name string, s Strategy)
func (r *Registry) Get(name string) (Strategy, bool)
func (r *Registry) List() []StrategyInfo
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/register | Register new user |
| POST | /api/v1/auth/login | Login, returns JWT |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Revoke refresh token |
| GET | /api/v1/auth/me | Get current user |

### Stocks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/stocks | List stocks (paginated) |
| POST | /api/v1/stocks | Create stock |
| GET | /api/v1/stocks/:id | Get stock by ID |
| PUT | /api/v1/stocks/:id | Update stock |
| DELETE | /api/v1/stocks/:id | Delete stock |
| GET | /api/v1/my-stocks | User's watchlist |
| POST | /api/v1/my-stocks | Add to watchlist |
| DELETE | /api/v1/my-stocks/:id | Remove from watchlist |

### Strategies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/strategies | List available strategies |
| GET | /api/v1/strategies/:id | Get strategy details |
| GET | /api/v1/my-strategies | User's configured strategies |
| POST | /api/v1/my-strategies | Configure strategy for user |
| PUT | /api/v1/my-strategies/:id | Update configuration |
| DELETE | /api/v1/my-strategies/:id | Remove configuration |

### Scans
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/scans | Start new scan |
| GET | /api/v1/scans | List user's scans |
| GET | /api/v1/scans/:id | Get scan details |
| GET | /api/v1/scans/:id/status | Get scan status |
| GET | /api/v1/scans/:id/results | Get scan results |
| DELETE | /api/v1/scans/:id | Delete scan |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/reports | List user's reports |
| POST | /api/v1/reports | Generate report |
| GET | /api/v1/reports/:id | Get report |
| GET | /api/v1/reports/:id/download | Download report file |
| DELETE | /api/v1/reports/:id | Delete report |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/analytics/performance | Strategy performance |
| GET | /api/v1/analytics/top-stocks | Top performing stocks |
| GET | /api/v1/analytics/trends | Stock trends |

---

## Frontend Architecture

### Project Structure

```
react-frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── ui/                  # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   └── index.ts
│   │   ├── layout/              # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MainLayout.tsx
│   │   ├── auth/                # Auth components
│   │   ├── dashboard/           # Dashboard components
│   │   ├── stocks/              # Stock components
│   │   ├── scans/               # Scan components
│   │   └── strategies/          # Strategy components
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Stocks.tsx
│   │   ├── Strategies.tsx
│   │   ├── Scans.tsx
│   │   └── Reports.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useStocks.ts
│   │   └── useScans.ts
│   ├── services/
│   │   ├── api.ts               # API client
│   │   └── auth.ts              # Auth service
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   ├── lib/
│   │   └── utils.ts             # Utility functions
│   ├── styles/
│   │   └── globals.css          # Tailwind + custom styles
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```

---

## Security Considerations

1. **Password Storage**: Bcrypt with cost factor 12
2. **JWT Tokens**: Short-lived access tokens (15min), longer refresh tokens (7 days)
3. **Token Rotation**: Refresh tokens rotated on each use
4. **CSRF Protection**: Double-submit cookie pattern
5. **Rate Limiting**: Applied to auth endpoints
6. **Input Validation**: All inputs validated and sanitized
7. **SQL Injection**: Prevented via GORM parameterized queries
8. **CORS**: Strictly configured origins

---

## Performance Optimizations

1. **Database Indexes**: On all frequently queried columns
2. **Pagination**: All list endpoints paginated
3. **N+1 Prevention**: Eager loading with GORM Preload
4. **Caching**: Redis for frequently accessed data (future)
5. **Background Jobs**: Async scan execution (future)
6. **Connection Pooling**: GORM connection pool configuration

---

## Deployment Considerations

1. **Environment Variables**: All secrets via env vars
2. **Database Migrations**: Versioned migrations
3. **Health Checks**: /health endpoint for orchestration
4. **Graceful Shutdown**: Proper signal handling
5. **Logging**: Structured JSON logging
6. **Metrics**: Prometheus-ready (future)

