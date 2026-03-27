import { MongoClient, Collection, Db } from 'mongodb';
import 'dotenv/config';

const MONGO_URL = process.env.MONGO_URL
  ?? `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST ?? 'localhost'}:${process.env.MONGO_PORT ?? 27017}/${process.env.MONGO_DB ?? 'quantdesk_chat'}?authSource=admin`;

const DB_NAME = process.env.MONGO_DB ?? 'quantdesk_chat';

let client: MongoClient | null = null;
let db: Db | null = null;

// ─── Document interfaces ───────────────────────────────────────────────────────

export interface IBMessageDocument {
  chatRoomId:        string;
  senderId:          string;
  messageType:       'text' | 'structured_inquiry' | 'file_ref' | 'system';
  encrypted: {
    iv:         string;   // base64, 12 bytes
    ciphertext: string;   // base64, AES-256-GCM ciphertext + tag
    tag:        string;   // base64, 16-byte GCM auth tag
  };
  aad: {
    chatRoomId:  string;
    senderId:    string;
    messageType: string;
  };
  encryptionVersion: 'AES256GCM_V1';
  deliveredTo:  string[];
  readBy:       string[];
  createdAt:    Date;
  editedAt:     Date | null;
  deletedAt:    Date | null;
}

export interface KeyBundleDocument {
  userId:     string;
  publicKey:  string;
  keyVersion: number;
  createdAt:  Date;
}

// ─── Connection with exponential backoff ───────────────────────────────────────
async function connect(attempt = 1): Promise<void> {
  try {
    client = new MongoClient(MONGO_URL, {
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS:         5_000,
    });
    await client.connect();
    db = client.db(DB_NAME);
    console.log('[mongo] Connected to', DB_NAME);
  } catch (err) {
    console.error(`[mongo] Connection attempt ${attempt} failed:`, (err as Error).message);
    if (attempt >= 5) {
      console.error('[mongo] Max reconnect attempts reached — continuing without MongoDB');
      return;
    }
    const delay = Math.min(attempt * 1_000, 10_000);
    await new Promise(r => setTimeout(r, delay));
    return connect(attempt + 1);
  }
}

export async function connectMongo(): Promise<void> {
  await connect();
}

export function getDb(): Db {
  if (!db) throw new Error('[mongo] Not connected — call connectMongo() first');
  return db;
}

export function messagesCollection(): Collection<IBMessageDocument> {
  return getDb().collection<IBMessageDocument>('messages');
}

export function keyBundlesCollection(): Collection<KeyBundleDocument> {
  return getDb().collection<KeyBundleDocument>('key_bundles');
}

export async function disconnectMongo(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}
