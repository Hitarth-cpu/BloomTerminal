-- Migration 019: AI analyses store

CREATE TABLE IF NOT EXISTS ai_analyses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  analysis_type   TEXT NOT NULL,
  subject_user_id UUID REFERENCES users(id),
  period_start    DATE,
  period_end      DATE,
  session_date    DATE,
  prompt_used     TEXT,
  raw_response    TEXT,
  model_used      TEXT,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  generated_by    UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyses_org     ON ai_analyses(org_id);
CREATE INDEX IF NOT EXISTS idx_analyses_type    ON ai_analyses(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analyses_subject ON ai_analyses(subject_user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_date    ON ai_analyses(created_at DESC);
