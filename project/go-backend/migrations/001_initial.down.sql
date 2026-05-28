-- Drop triggers
DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
DROP TRIGGER IF EXISTS update_scans_updated_at ON scans;
DROP TRIGGER IF EXISTS update_user_strategies_updated_at ON user_strategies;
DROP TRIGGER IF EXISTS update_strategies_updated_at ON strategies;
DROP TRIGGER IF EXISTS update_stocks_updated_at ON stocks;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse order of creation (respecting foreign keys)
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS scan_results;
DROP TABLE IF EXISTS scan_strategies;
DROP TABLE IF EXISTS scan_stocks;
DROP TABLE IF EXISTS scans;
DROP TABLE IF EXISTS user_strategies;
DROP TABLE IF EXISTS strategies;
DROP TABLE IF EXISTS user_stocks;
DROP TABLE IF EXISTS stocks;
DROP TABLE IF EXISTS refresh_sessions;
DROP TABLE IF EXISTS users;

