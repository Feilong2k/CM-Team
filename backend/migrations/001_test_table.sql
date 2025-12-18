-- Test migration to verify migration runner works
-- Creates a simple test table

CREATE TABLE IF NOT EXISTS migration_test (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a test record
INSERT INTO migration_test (name) VALUES ('Migration runner test');

-- Create an index
CREATE INDEX IF NOT EXISTS idx_migration_test_name ON migration_test(name);
