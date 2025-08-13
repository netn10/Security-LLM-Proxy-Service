-- Migration: Create request_logs table
-- Date: 2024-01-01
-- Description: Initial migration to create the request_logs table

CREATE TABLE IF NOT EXISTS request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    provider VARCHAR(50) NOT NULL,
    anonymizedPayload TEXT NOT NULL,
    action VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255),
    responseTime INTEGER,
    errorMessage TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_request_logs_provider ON request_logs(provider);
CREATE INDEX IF NOT EXISTS idx_request_logs_action ON request_logs(action);

-- No triggers needed for this simplified schema
