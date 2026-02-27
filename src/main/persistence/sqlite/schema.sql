-- Providers table
-- Stores API credentials for LLM providers
CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    provider_name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    base_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Employees table
-- Stores digital employee (agent) configurations
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT,
    type TEXT NOT NULL CHECK(type IN ('planner', 'generalist', 'specialist', 'executor')),
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    system_prompt TEXT,
    mcp_tools TEXT,
    override_params TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_providers_active ON providers(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_provider ON employees(provider_id);
CREATE INDEX IF NOT EXISTS idx_employees_type ON employees(type);

-- Conversations table
-- Stores chat conversation metadata
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    model_profile_id TEXT,
    workspace_path TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Messages table
-- Stores individual messages within conversations
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    status TEXT DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'error')),
    trace TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for conversations and messages
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
