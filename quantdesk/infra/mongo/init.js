// ─── MongoDB init script ───────────────────────────────────────────────────────
// Runs inside the mongo container on first boot as root.
// Creates the quantdesk_chat database, collections, and indexes.

const db = db.getSiblingDB('quantdesk_chat');

// ── messages collection ────────────────────────────────────────────────────────
db.createCollection('messages');

// Primary query pattern: all messages in a room, newest first
db.messages.createIndex(
  { chatRoomId: 1, createdAt: -1 },
  { background: true }
);

// Sender history lookup
db.messages.createIndex(
  { senderId: 1, createdAt: -1 },
  { background: true }
);

// TTL index: auto-delete messages older than 90 days (7,776,000 seconds)
db.messages.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 7776000, background: true }
);

// Soft-delete filter support
db.messages.createIndex(
  { chatRoomId: 1, deletedAt: 1 },
  { background: true }
);

// ── key_bundles collection ─────────────────────────────────────────────────────
db.createCollection('key_bundles');

// One key bundle per (userId, recipientId) pair — unique
db.key_bundles.createIndex(
  { userId: 1 },
  { unique: true, background: true }
);

print('QuantDesk MongoDB init complete: collections and indexes created.');
