-- SwarmIDE2 PostgreSQL Schema

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active',
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  spec JSONB,
  normalized_spec JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active',
  INDEX idx_project_id (project_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);

-- Executions table
CREATE TABLE IF NOT EXISTS executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  workflow_id VARCHAR(255),
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  error_message TEXT,
  INDEX idx_session_id (session_id),
  INDEX idx_status (status),
  INDEX idx_created_at (started_at)
);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
  agent_id VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255),
  content JSONB NOT NULL,
  confidence DECIMAL(3, 2),
  cost_estimate DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_agent_id (agent_id),
  INDEX idx_confidence (confidence)
);

-- Checkpoints table (for durable workflows)
CREATE TABLE IF NOT EXISTS checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  step_id VARCHAR(255) NOT NULL,
  state JSONB,
  result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_execution_id (execution_id),
  INDEX idx_step_id (step_id)
);

-- Costs table
CREATE TABLE IF NOT EXISTS costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  model VARCHAR(255),
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd DECIMAL(10, 4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_model (model)
);

-- Vector embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  agent_id VARCHAR(255),
  text TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_agent_id (agent_id)
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
  level VARCHAR(20) DEFAULT 'info',
  message TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_level (level),
  INDEX idx_created_at (created_at)
);

-- Health checks table
CREATE TABLE IF NOT EXISTS health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  latency_ms INTEGER,
  error_message TEXT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_service_name (service_name),
  INDEX idx_checked_at (checked_at)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_project_status ON sessions(project_id, status);
CREATE INDEX IF NOT EXISTS idx_executions_session_status ON executions(session_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_session_confidence ON proposals(session_id, confidence DESC);

-- Create views for common queries
CREATE OR REPLACE VIEW recent_projects AS
SELECT 
  p.id,
  p.name,
  p.user_id,
  COUNT(DISTINCT s.id) as session_count,
  COUNT(DISTINCT e.id) as execution_count,
  MAX(e.completed_at) as last_execution,
  p.created_at
FROM projects p
LEFT JOIN sessions s ON p.id = s.project_id
LEFT JOIN executions e ON s.id = e.session_id
GROUP BY p.id
ORDER BY p.created_at DESC;

CREATE OR REPLACE VIEW project_costs AS
SELECT 
  s.project_id,
  s.id as session_id,
  SUM(c.cost_usd) as total_cost,
  SUM(c.input_tokens) as total_input_tokens,
  SUM(c.output_tokens) as total_output_tokens,
  COUNT(DISTINCT c.model) as models_used
FROM sessions s
LEFT JOIN costs c ON s.id = c.session_id
GROUP BY s.project_id, s.id;

CREATE OR REPLACE VIEW project_statistics AS
SELECT 
  p.id,
  p.name,
  COUNT(DISTINCT s.id) as total_sessions,
  COUNT(DISTINCT e.id) as total_executions,
  AVG(e.duration_ms) as avg_execution_time,
  SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
  SUM(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END) as failed_executions
FROM projects p
LEFT JOIN sessions s ON p.id = s.project_id
LEFT JOIN executions e ON s.id = e.session_id
GROUP BY p.id;
