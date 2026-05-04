-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- =============================================================================
-- REFRESH SESSIONS TABLE (JWT Token Rotation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS refresh_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    user_agent VARCHAR(512),
    ip_address VARCHAR(64),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    replaced_by VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_sessions_token_hash ON refresh_sessions(token_hash);
CREATE INDEX idx_refresh_sessions_user_id ON refresh_sessions(user_id);
CREATE INDEX idx_refresh_sessions_user_revoked ON refresh_sessions(user_id, revoked_at);

-- =============================================================================
-- STOCKS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL UNIQUE,
    exchange VARCHAR(20) NOT NULL DEFAULT 'NS',
    name VARCHAR(255),
    sector VARCHAR(100),
    market_cap DECIMAL(20, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_stocks_symbol ON stocks(symbol) WHERE deleted_at IS NULL;
CREATE INDEX idx_stocks_sector ON stocks(sector) WHERE deleted_at IS NULL;
CREATE INDEX idx_stocks_active ON stocks(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_stocks_deleted_at ON stocks(deleted_at);

-- =============================================================================
-- USER STOCKS TABLE (Watchlist)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    notes TEXT,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, stock_id)
);

CREATE INDEX idx_user_stocks_user_id ON user_stocks(user_id);
CREATE INDEX idx_user_stocks_user_stock ON user_stocks(user_id, stock_id);

-- =============================================================================
-- STRATEGIES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    parameters JSONB,
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_strategies_name ON strategies(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_strategies_active ON strategies(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_strategies_system ON strategies(is_system) WHERE deleted_at IS NULL;
CREATE INDEX idx_strategies_deleted_at ON strategies(deleted_at);

-- =============================================================================
-- USER STRATEGIES TABLE (User's configured strategies)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    custom_name VARCHAR(200),
    parameters JSONB,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, strategy_id)
);

CREATE INDEX idx_user_strategies_user_id ON user_strategies(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_strategies_enabled ON user_strategies(user_id, is_enabled) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_strategies_user_strategy ON user_strategies(user_id, strategy_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_strategies_deleted_at ON user_strategies(deleted_at);

-- =============================================================================
-- SCANS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_stocks INTEGER NOT NULL DEFAULT 0,
    processed_stocks INTEGER NOT NULL DEFAULT 0,
    successful_stocks INTEGER NOT NULL DEFAULT 0,
    failed_stocks INTEGER NOT NULL DEFAULT 0,
    execution_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_user_status ON scans(user_id, status);
CREATE INDEX idx_scans_created_at ON scans(created_at);

-- =============================================================================
-- SCAN STOCKS TABLE (Stocks included in a scan)
-- =============================================================================
CREATE TABLE IF NOT EXISTS scan_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    UNIQUE(scan_id, stock_id)
);

CREATE INDEX idx_scan_stocks_scan_id ON scan_stocks(scan_id);

-- =============================================================================
-- SCAN STRATEGIES TABLE (Strategies used in a scan)
-- =============================================================================
CREATE TABLE IF NOT EXISTS scan_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    user_strategy_id UUID NOT NULL REFERENCES user_strategies(id) ON DELETE CASCADE,
    parameters_snapshot JSONB,
    UNIQUE(scan_id, user_strategy_id)
);

CREATE INDEX idx_scan_strategies_scan_id ON scan_strategies(scan_id);

-- =============================================================================
-- SCAN RESULTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS scan_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    strategy_id UUID NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    current_price DECIMAL(12, 4),
    result_data JSONB,
    score DECIMAL(10, 4),
    signal VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_results_scan_id ON scan_results(scan_id);
CREATE INDEX idx_scan_results_stock_id ON scan_results(stock_id);
CREATE INDEX idx_scan_results_strategy_id ON scan_results(strategy_id);
CREATE INDEX idx_scan_results_symbol ON scan_results(symbol);
CREATE INDEX idx_scan_results_created_at ON scan_results(created_at);
CREATE INDEX idx_scan_results_scan_strategy ON scan_results(scan_id, strategy_id);
CREATE INDEX idx_scan_results_scan_stock ON scan_results(scan_id, stock_id);

-- =============================================================================
-- REPORTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    file_path VARCHAR(512),
    file_size INTEGER,
    metadata JSONB,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_reports_user_id ON reports(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reports_scan_id ON reports(scan_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reports_deleted_at ON reports(deleted_at);

-- =============================================================================
-- TRIGGER: Auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stocks_updated_at BEFORE UPDATE ON stocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_strategies_updated_at BEFORE UPDATE ON user_strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scans_updated_at BEFORE UPDATE ON scans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SEED: Default Strategies
-- =============================================================================
INSERT INTO strategies (name, display_name, description, category, parameters, is_system, is_active)
VALUES
    (
        'avwap_proximity',
        'AVWAP Proximity',
        'Identifies stocks trading within a specified tolerance of their Anchored Volume Weighted Average Price. AVWAP from a significant date often acts as support/resistance.',
        'technical',
        '{"anchor_date": "2020-03-22", "tolerance": 0.05, "min_volume": 100000}'::jsonb,
        true,
        true
    ),
    (
        'week_52_extremes',
        '52-Week Extremes',
        'Finds stocks trading near their 52-week high or low. These levels often represent significant support/resistance zones.',
        'technical',
        '{"threshold": 0.02, "lookback_days": 252}'::jsonb,
        true,
        true
    ),
    (
        'volume_breakout',
        'Volume Breakout',
        'Detects stocks with volume significantly above their average. High volume often precedes or confirms price breakouts.',
        'technical',
        '{"multiplier": 2.0, "avg_period": 20, "min_volume": 100000}'::jsonb,
        true,
        true
    ),
    (
        'momentum',
        'Momentum Stocks',
        'Identifies stocks with strong recent performance across multiple timeframes. Momentum investing is based on the idea that trends tend to persist.',
        'technical',
        '{"threshold_5d": 3.0, "threshold_10d": 5.0, "threshold_20d": 10.0}'::jsonb,
        true,
        true
    )
ON CONFLICT (name) DO NOTHING;

