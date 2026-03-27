import { query, transaction } from '../../db/postgres';

export interface Document {
  id:           string;
  user_id:      string;
  title:        string;
  doc_type:     string;
  storage_key:  string;
  mime_type:    string;
  size_bytes:   number;
  status:       'processing' | 'ready' | 'error';
  page_count:   number | null;
  metadata:     Record<string, unknown>;
  created_at:   Date;
  updated_at:   Date;
}

export interface DocumentChunk {
  id:          string;
  document_id: string;
  chunk_index: number;
  content:     string;
  tokens:      number | null;
  embedding:   number[] | null;
  metadata:    Record<string, unknown>;
  created_at:  Date;
}

export interface CreateDocumentInput {
  userId:     string;
  title:      string;
  docType:    string;
  storageKey: string;
  mimeType:   string;
  sizeBytes:  number;
  pageCount?: number;
  metadata?:  Record<string, unknown>;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const rows = await query<Document>(`
    INSERT INTO documents
      (user_id, title, doc_type, storage_key, mime_type, size_bytes, page_count, metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `, [
    input.userId, input.title, input.docType, input.storageKey,
    input.mimeType, input.sizeBytes, input.pageCount ?? null,
    JSON.stringify(input.metadata ?? {}),
  ]);
  return rows[0];
}

export async function getDocument(id: string, userId?: string): Promise<Document | null> {
  const rows = userId
    ? await query<Document>('SELECT * FROM documents WHERE id=$1 AND user_id=$2', [id, userId])
    : await query<Document>('SELECT * FROM documents WHERE id=$1', [id]);
  return rows[0] ?? null;
}

export async function listDocuments(userId: string, docType?: string): Promise<Document[]> {
  return docType
    ? query<Document>(
        'SELECT * FROM documents WHERE user_id=$1 AND doc_type=$2 ORDER BY created_at DESC',
        [userId, docType],
      )
    : query<Document>(
        'SELECT * FROM documents WHERE user_id=$1 ORDER BY created_at DESC',
        [userId],
      );
}

export async function setDocumentStatus(
  id: string,
  status: Document['status'],
): Promise<void> {
  await query('UPDATE documents SET status=$2 WHERE id=$1', [id, status]);
}

export async function deleteDocument(id: string, userId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    'DELETE FROM documents WHERE id=$1 AND user_id=$2 RETURNING id',
    [id, userId],
  );
  return rows.length > 0;
}

// ─── Chunks & Embeddings ──────────────────────────────────────────────────────

export interface ChunkInput {
  documentId:  string;
  chunkIndex:  number;
  content:     string;
  tokens?:     number;
  embedding?:  number[];
  metadata?:   Record<string, unknown>;
}

export async function saveChunks(chunks: ChunkInput[]): Promise<void> {
  if (chunks.length === 0) return;

  await transaction(async (client) => {
    for (const c of chunks) {
      const embeddingLiteral = c.embedding
        ? `'[${c.embedding.join(',')}]'::vector`
        : 'NULL';

      await client.query(`
        INSERT INTO document_chunks
          (document_id, chunk_index, content, tokens, embedding, metadata)
        VALUES ($1,$2,$3,$4,${embeddingLiteral},$5)
        ON CONFLICT (document_id, chunk_index) DO UPDATE SET
          content   = EXCLUDED.content,
          tokens    = EXCLUDED.tokens,
          embedding = EXCLUDED.embedding,
          metadata  = EXCLUDED.metadata
      `, [
        c.documentId, c.chunkIndex, c.content,
        c.tokens ?? null, JSON.stringify(c.metadata ?? {}),
      ]);
    }
  });
}

export async function getChunks(documentId: string): Promise<DocumentChunk[]> {
  return query<DocumentChunk>(`
    SELECT id, document_id, chunk_index, content, tokens, metadata, created_at
    FROM document_chunks
    WHERE document_id = $1
    ORDER BY chunk_index
  `, [documentId]);
}

// ─── Full-text search ─────────────────────────────────────────────────────────

export interface SearchResult {
  document_id:  string;
  chunk_id:     string;
  title:        string;
  doc_type:     string;
  chunk_index:  number;
  content:      string;
  rank:         number;
}

export async function fullTextSearch(
  userId: string,
  q: string,
  limit = 10,
): Promise<SearchResult[]> {
  return query<SearchResult>(`
    SELECT
      d.id            AS document_id,
      c.id            AS chunk_id,
      d.title,
      d.doc_type,
      c.chunk_index,
      c.content,
      ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', $2)) AS rank
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE d.user_id  = $1
      AND d.status   = 'ready'
      AND to_tsvector('english', c.content) @@ plainto_tsquery('english', $2)
    ORDER BY rank DESC
    LIMIT $3
  `, [userId, q, limit]);
}

// ─── Vector similarity search (RAG) ──────────────────────────────────────────

export interface VectorSearchResult {
  document_id: string;
  chunk_id:    string;
  title:       string;
  doc_type:    string;
  chunk_index: number;
  content:     string;
  distance:    number;
}

export async function vectorSearch(
  userId: string,
  embedding: number[],
  limit = 5,
): Promise<VectorSearchResult[]> {
  const embeddingLiteral = `[${embedding.join(',')}]`;

  return query<VectorSearchResult>(`
    SELECT
      d.id            AS document_id,
      c.id            AS chunk_id,
      d.title,
      d.doc_type,
      c.chunk_index,
      c.content,
      c.embedding <=> $2::vector AS distance
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE d.user_id = $1
      AND d.status  = 'ready'
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> $2::vector
    LIMIT $3
  `, [userId, embeddingLiteral, limit]);
}

/** Hybrid search: combine full-text rank + vector distance with RRF fusion. */
export async function hybridSearch(
  userId: string,
  q: string,
  embedding: number[],
  limit = 5,
): Promise<VectorSearchResult[]> {
  const embeddingLiteral = `[${embedding.join(',')}]`;

  // Reciprocal Rank Fusion (k=60 constant)
  return query<VectorSearchResult>(`
    WITH fts AS (
      SELECT c.id AS chunk_id,
             ROW_NUMBER() OVER (ORDER BY
               ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', $2)) DESC
             ) AS rank
      FROM document_chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE d.user_id = $1 AND d.status = 'ready'
        AND to_tsvector('english', c.content) @@ plainto_tsquery('english', $2)
      LIMIT 60
    ),
    vec AS (
      SELECT c.id AS chunk_id,
             ROW_NUMBER() OVER (ORDER BY c.embedding <=> $3::vector) AS rank
      FROM document_chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE d.user_id = $1 AND d.status = 'ready' AND c.embedding IS NOT NULL
      LIMIT 60
    ),
    fused AS (
      SELECT COALESCE(fts.chunk_id, vec.chunk_id) AS chunk_id,
             COALESCE(1.0/(60+fts.rank),0) + COALESCE(1.0/(60+vec.rank),0) AS score
      FROM fts FULL OUTER JOIN vec ON fts.chunk_id = vec.chunk_id
    )
    SELECT
      d.id  AS document_id,
      c.id  AS chunk_id,
      d.title,
      d.doc_type,
      c.chunk_index,
      c.content,
      1 - f.score AS distance
    FROM fused f
    JOIN document_chunks c ON c.id = f.chunk_id
    JOIN documents       d ON d.id = c.document_id
    ORDER BY f.score DESC
    LIMIT $4
  `, [userId, q, embeddingLiteral, limit]);
}
