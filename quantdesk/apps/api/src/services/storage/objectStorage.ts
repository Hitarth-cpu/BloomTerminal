import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET  = process.env.S3_BUCKET  ?? 'quantdesk-documents';
const REGION  = process.env.S3_REGION  ?? 'auto';
const ENDPOINT = process.env.S3_ENDPOINT; // set for Cloudflare R2 / MinIO

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  _client = new S3Client({
    region:   REGION,
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId:     process.env.S3_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
    // Required for path-style URLs (MinIO / R2)
    forcePathStyle: !!ENDPOINT,
  });

  return _client;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a deterministic storage key for a user's document. */
export function buildStorageKey(userId: string, documentId: string, filename: string): string {
  const ext = filename.includes('.') ? filename.split('.').pop() : 'bin';
  return `documents/${userId}/${documentId}.${ext}`;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function uploadDocument(
  storageKey: string,
  body: Buffer | Uint8Array | ReadableStream,
  mimeType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         storageKey,
      Body:        body as Buffer,
      ContentType: mimeType,
      // Prevent public access — presigned URLs are used for downloads
      ACL: 'private',
    }),
  );
}

/** Returns a presigned GET URL valid for `expiresIn` seconds (default 15 min). */
export async function getDocumentUrl(
  storageKey: string,
  expiresIn = 900,
): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: BUCKET, Key: storageKey }),
    { expiresIn },
  );
}

export async function deleteDocument(storageKey: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: storageKey }),
  );
}

/** Alias for getDocumentUrl — returns a presigned GET URL. */
export const getPresignedUrl = getDocumentUrl;

export async function documentExists(storageKey: string): Promise<boolean> {
  try {
    await getClient().send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: storageKey }),
    );
    return true;
  } catch {
    return false;
  }
}
