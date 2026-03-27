CREATE TABLE IF NOT EXISTS documents (
  id               UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID    NOT NULL REFERENCES users(id),
  title            TEXT    NOT NULL,
  doc_type         TEXT    NOT NULL,
  ticker           TEXT,
  security_id      UUID    REFERENCES securities(id),
  source           TEXT,
  published_at     TIMESTAMPTZ,
  s3_key           TEXT    NOT NULL,
  file_size_bytes  INTEGER,
  mime_type        TEXT    DEFAULT 'application/pdf',
  page_count       INTEGER,
  extracted_text   TEXT,
  summary          TEXT,
  is_indexed       BOOLEAN DEFAULT false,
  metadata         JSONB   DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_user_id   ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_docs_ticker    ON documents(ticker);
CREATE INDEX IF NOT EXISTS idx_docs_type      ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_docs_published ON documents(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_text      ON documents
  USING gin(to_tsvector('english', COALESCE(extracted_text, '')));

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Vector embeddings for RAG (chunked document segments)
CREATE TABLE IF NOT EXISTS document_chunks (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text  TEXT    NOT NULL,
  embedding   bytea,  -- use vector(1536) if pgvector is installed
  token_count INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON document_chunks(document_id);

-- IVFFlat approximate nearest-neighbor index.
-- NOTE: Build this AFTER inserting at least 1000 rows for optimal performance.
-- CREATE INDEX idx_chunks_embedding ON document_chunks
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
