-- Migration: Add token tracking fields to messages table
-- Run this migration on existing databases to add token statistics support

-- Add token fields to messages table (SQLite allows adding nullable columns)
ALTER TABLE messages ADD COLUMN prompt_tokens INTEGER;
ALTER TABLE messages ADD COLUMN completion_tokens INTEGER;
ALTER TABLE messages ADD COLUMN total_tokens INTEGER;

-- Create index for token queries
CREATE INDEX IF NOT EXISTS idx_messages_tokens ON messages(total_tokens) WHERE total_tokens IS NOT NULL;
