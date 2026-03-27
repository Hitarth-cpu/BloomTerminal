-- Migration 025: Document AI tables (summaries, highlights, annotations, research notes)

CREATE TABLE IF NOT EXISTS document_summaries (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id             UUID UNIQUE NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  executive_summary       TEXT,
  key_points              JSONB DEFAULT '[]',
  sentiment               TEXT CHECK (sentiment IN ('bullish','bearish','neutral')),
  sentiment_justification TEXT,
  key_metrics             JSONB DEFAULT '[]',
  risks_identified        JSONB DEFAULT '[]',
  key_quotes              JSONB DEFAULT '[]',
  highlights              JSONB DEFAULT '[]',
  model_used              TEXT,
  generated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_highlights (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  text_excerpt   TEXT NOT NULL,
  highlight_type TEXT CHECK (highlight_type IN ('key_metric','risk_factor','guidance','catalyst','management_comment','price_target')),
  importance     INTEGER CHECK (importance BETWEEN 1 AND 10),
  page_ref       TEXT,
  char_start     INTEGER,
  char_end       INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_annotations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_text TEXT NOT NULL,
  note          TEXT,
  color         TEXT DEFAULT 'amber',
  page_ref      TEXT,
  char_start    INTEGER,
  char_end      INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  ticker      TEXT,
  note_type   TEXT DEFAULT 'research',
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS askb_feedback (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  rating     TEXT CHECK (rating IN ('up','down')),
  query      TEXT,
  response   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_highlights_doc  ON document_highlights(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_annotations_doc ON document_annotations(document_id, user_id);
CREATE INDEX IF NOT EXISTS idx_research_notes_user ON research_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_notes_tick ON research_notes(ticker);

CREATE OR REPLACE TRIGGER set_research_notes_updated_at
  BEFORE UPDATE ON research_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
