-- Update role column to support 'premium' role
-- Existing roles: 'user', 'admin'
-- New role: 'premium'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'premium', 'admin'));

COMMENT ON COLUMN users.role IS 'user = free tier, premium = paid tier, admin = full access';
