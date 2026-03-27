/**
 * MongoDB bootstrap — run once after seedDatabase.ts
 * Usage: npx ts-node --project apps/api/tsconfig.json scripts/seedMongoDB.ts
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const ROOM_AB  = '00000000-0000-0000-0004-000000000001';
const ALICE_ID = '00000000-0000-0000-0002-000000000001';

async function seedMongo() {
  const client = new MongoClient(process.env.MONGO_URL ?? 'mongodb://localhost:27017/quantdesk_chat');
  await client.connect();
  console.log('✅ MongoDB connected');

  const db = client.db('quantdesk_chat');

  // Create collections (ignore if already exist)
  for (const col of ['messages', 'key_bundles']) {
    try { await db.createCollection(col); } catch { /* exists */ }
  }

  // Indexes
  const messages = db.collection('messages');
  await messages.createIndex({ chatRoomId: 1, createdAt: -1 });
  await messages.createIndex({ senderId: 1, createdAt: -1 });
  await messages.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7_776_000 }); // 90 days

  const keys = db.collection('key_bundles');
  await keys.createIndex({ userId: 1 }, { unique: true });

  // System welcome message
  await messages.insertOne({
    chatRoomId: ROOM_AB,
    senderId: 'system',
    messageType: 'system',
    encrypted: null,
    plaintext: 'Welcome to QuantDesk IB Chat. Messages are end-to-end encrypted with AES-256-GCM.',
    aad: { chatRoomId: ROOM_AB, senderId: 'system', messageType: 'system' },
    encryptionVersion: 'NONE',
    deliveredTo: [],
    readBy: [],
    createdAt: new Date(),
    editedAt: null,
    deletedAt: null,
  });

  console.log('✅ MongoDB seeded — collections: messages, key_bundles');
  console.log(`   Welcome message in room: ${ROOM_AB}`);
  await client.close();
}

seedMongo().catch(e => { console.error(e); process.exit(1); });
