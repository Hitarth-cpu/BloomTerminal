-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- vector extension (pgvector) — optional, needed for AI embeddings
-- Install pgvector separately if needed: https://github.com/pgvector/pgvector
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS "vector"; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pgvector not available — skipping (AI embeddings will not work)'; END $$;
