/**
 * Chat service — MongoDB.
 *
 * SECURITY CONTRACT:
 *   This service stores and retrieves AES-256-GCM ciphertext blobs.
 *   It MUST NOT log, inspect, or attempt to decode the encrypted, iv,
 *   ciphertext, or tag fields. Only structural metadata is logged.
 */

import { ObjectId } from 'mongodb';
import { messagesCollection, keyBundlesCollection, IBMessageDocument, KeyBundleDocument } from '../../db/mongo';

export type NewMessage = Omit<IBMessageDocument, 'deliveredTo' | 'readBy' | 'createdAt' | 'editedAt' | 'deletedAt'>;

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function saveMessage(payload: NewMessage): Promise<string> {
  const doc: IBMessageDocument = {
    ...payload,
    deliveredTo: [],
    readBy:      [],
    createdAt:   new Date(),
    editedAt:    null,
    deletedAt:   null,
  };

  const result = await messagesCollection().insertOne(doc);

  // Log ONLY non-sensitive metadata
  console.log('[chat] Message saved', {
    id:          result.insertedId.toString(),
    chatRoomId:  payload.chatRoomId,
    senderId:    payload.senderId,
    messageType: payload.messageType,
    createdAt:   doc.createdAt.toISOString(),
  });

  return result.insertedId.toString();
}

export interface GetMessagesOptions {
  before?: Date;
  limit?:  number;
}

export async function getMessages(
  chatRoomId: string,
  options: GetMessagesOptions = {},
): Promise<IBMessageDocument[]> {
  const filter: Record<string, unknown> = {
    chatRoomId,
    deletedAt: null,
  };

  if (options.before) {
    filter.createdAt = { $lt: options.before };
  }

  return messagesCollection()
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(options.limit ?? 50)
    .toArray();
}

export async function markDelivered(messageId: string, userId: string): Promise<void> {
  await messagesCollection().updateOne(
    { _id: new ObjectId(messageId) },
    { $addToSet: { deliveredTo: userId } },
  );
}

export async function markRead(messageId: string, userId: string): Promise<void> {
  await messagesCollection().updateOne(
    { _id: new ObjectId(messageId) },
    { $addToSet: { readBy: userId } },
  );
}

export async function softDeleteMessage(messageId: string, requestingUserId: string): Promise<boolean> {
  const result = await messagesCollection().updateOne(
    { _id: new ObjectId(messageId), senderId: requestingUserId, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  );
  return result.modifiedCount === 1;
}

export async function clearRoomMessages(chatRoomId: string): Promise<number> {
  const result = await messagesCollection().deleteMany({ chatRoomId });
  return result.deletedCount;
}

// ─── ECDH public keys ─────────────────────────────────────────────────────────

export async function savePublicKey(userId: string, publicKey: string): Promise<void> {
  await keyBundlesCollection().updateOne(
    { userId },
    {
      $set:         { publicKey, updatedAt: new Date() },
      $setOnInsert: { userId, keyVersion: 1, createdAt: new Date() },
      $inc:         { keyVersion: 1 },
    },
    { upsert: true },
  );
}

export async function getPublicKey(userId: string): Promise<string | null> {
  const doc = await keyBundlesCollection().findOne({ userId });
  return doc?.publicKey ?? null;
}
