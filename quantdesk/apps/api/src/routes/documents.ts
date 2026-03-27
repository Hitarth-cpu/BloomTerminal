import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import {
  createDocument, getDocument, listDocuments,
  setDocumentStatus, deleteDocument as deleteDocumentRecord,
  saveChunks, fullTextSearch, vectorSearch, hybridSearch,
} from '../services/db/documentService';
import {
  uploadDocument, getDocumentUrl, deleteDocument as deleteFromStorage,
  buildStorageKey,
} from '../services/storage/objectStorage';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

/** GET /api/documents */
router.get('/', async (req, res) => {
  const { docType } = req.query as { docType?: string };
  const docs = await listDocuments(req.user.id, docType);
  res.json({ documents: docs });
});

/** POST /api/documents — multipart upload */
router.post('/', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: 'file required' }); return; }

  const { title, docType = 'general' } = req.body as { title?: string; docType?: string };
  const documentId  = randomUUID();
  const storageKey  = buildStorageKey(req.user.id, documentId, file.originalname);

  // Create DB record first (status: processing)
  const doc = await createDocument({
    userId:     req.user.id,
    title:      title ?? file.originalname,
    docType,
    storageKey,
    mimeType:   file.mimetype,
    sizeBytes:  file.size,
    metadata:   { originalName: file.originalname },
  });

  // Upload to object storage (fire-and-forget status update)
  uploadDocument(storageKey, file.buffer, file.mimetype)
    .then(() => setDocumentStatus(doc.id, 'ready'))
    .catch(async (err) => {
      console.error('[documents] Upload failed', err);
      await setDocumentStatus(doc.id, 'error');
    });

  res.status(201).json({ document: doc });
});

/** GET /api/documents/:id */
router.get('/:id', async (req, res) => {
  const doc = await getDocument(req.params.id, req.user.id);
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }
  res.json({ document: doc });
});

/** GET /api/documents/:id/url — presigned download URL */
router.get('/:id/url', async (req, res) => {
  const doc = await getDocument(req.params.id, req.user.id);
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }
  const url = await getDocumentUrl(doc.storage_key);
  res.json({ url });
});

/** DELETE /api/documents/:id */
router.delete('/:id', async (req, res) => {
  const doc = await getDocument(req.params.id, req.user.id);
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }

  await Promise.all([
    deleteDocumentRecord(doc.id, req.user.id),
    deleteFromStorage(doc.storage_key),
  ]);
  res.json({ ok: true });
});

/** POST /api/documents/:id/chunks — ingest chunks + embeddings */
router.post('/:id/chunks', async (req, res) => {
  const doc = await getDocument(req.params.id, req.user.id);
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return; }

  const { chunks } = req.body as { chunks: Array<{
    chunkIndex: number;
    content: string;
    tokens?: number;
    embedding?: number[];
    metadata?: Record<string, unknown>;
  }> };

  if (!Array.isArray(chunks)) { res.status(400).json({ error: 'chunks array required' }); return; }

  await saveChunks(chunks.map(c => ({ ...c, documentId: doc.id })));
  res.json({ ok: true, count: chunks.length });
});

/** GET /api/documents/search?q=text — full-text */
router.get('/search/text', async (req, res) => {
  const { q, limit } = req.query as { q?: string; limit?: string };
  if (!q) { res.status(400).json({ error: 'q required' }); return; }
  const results = await fullTextSearch(req.user.id, q, limit ? Number(limit) : 10);
  res.json({ results });
});

/** POST /api/documents/search/vector — nearest-neighbour */
router.post('/search/vector', async (req, res) => {
  const { embedding, limit } = req.body as { embedding?: number[]; limit?: number };
  if (!Array.isArray(embedding)) { res.status(400).json({ error: 'embedding array required' }); return; }
  const results = await vectorSearch(req.user.id, embedding, limit ?? 5);
  res.json({ results });
});

/** POST /api/documents/search/hybrid — RRF fusion */
router.post('/search/hybrid', async (req, res) => {
  const { q, embedding, limit } = req.body as { q?: string; embedding?: number[]; limit?: number };
  if (!q || !Array.isArray(embedding)) {
    res.status(400).json({ error: 'q and embedding required' }); return;
  }
  const results = await hybridSearch(req.user.id, q, embedding, limit ?? 5);
  res.json({ results });
});

export default router;
