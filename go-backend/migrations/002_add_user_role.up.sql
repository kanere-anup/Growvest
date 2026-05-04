-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' NOT NULL;

-- Add index for role
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Set first user as admin (optional - you can change this)
-- UPDATE users SET role = 'admin' WHERE email = 'admin@growvest.com';

-- Comment: Role values
-- 'user' - Regular user (default), can only view stocks, manage their own scans and strategies
-- 'admin' - Administrator, can create/update/delete stocks, manage system settings




