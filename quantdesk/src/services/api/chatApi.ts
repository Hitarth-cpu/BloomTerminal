import { api } from './apiClient';

export interface ApiMessage {
  _id:        string;
  chatRoomId: string;
  senderId:   string;
  messageType: 'text' | 'structured_inquiry' | 'file_ref' | 'system';
  encrypted:  { iv: string; ciphertext: string; tag: string };
  aad:        { chatRoomId: string; senderId: string; messageType: string };
  deliveredTo: string[];
  readBy:      string[];
  createdAt:   string;
  deletedAt:   string | null;
}

export async function fetchMessages(roomId: string, before?: string, limit = 50): Promise<ApiMessage[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', before);
  const { messages } = await api.get<{ messages: ApiMessage[] }>(`/chat/rooms/${roomId}/messages?${params}`);
  return messages;
}

export async function sendMessage(roomId: string, payload: {
  messageType: ApiMessage['messageType'];
  encrypted:   ApiMessage['encrypted'];
  aad:         ApiMessage['aad'];
}): Promise<string> {
  const { id } = await api.post<{ id: string }>(`/chat/rooms/${roomId}/messages`, payload);
  return id;
}

export async function markDelivered(messageId: string): Promise<void> {
  await api.patch(`/chat/messages/${messageId}/delivered`, {});
}

export async function markRead(messageId: string): Promise<void> {
  await api.patch(`/chat/messages/${messageId}/read`, {});
}

export async function deleteMessage(messageId: string): Promise<void> {
  await api.delete(`/chat/messages/${messageId}`);
}

export async function publishPublicKey(publicKey: string): Promise<void> {
  await api.request('/chat/keys', { method: 'PUT', body: JSON.stringify({ publicKey }) });
}

export async function fetchPublicKey(userId: string): Promise<string | null> {
  try {
    const { publicKey } = await api.get<{ publicKey: string }>(`/chat/keys/${userId}`);
    return publicKey;
  } catch {
    return null;
  }
}
