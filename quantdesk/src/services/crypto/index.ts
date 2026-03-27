export type { EncryptedPayload } from './messageCrypto';
export { encryptMessage, decryptMessage } from './messageCrypto';

export { storeKey, loadKey, deleteKey } from './keyStore';

export type { ECDHKeyPair } from './ecdhKeyExchange';
export {
  getOrCreateUserKeyPair,
  exportPublicKey,
  importPeerPublicKey,
  deriveSharedKey,
  generatePSK,
  importPSK,
  getOrCreateChatKey,
} from './ecdhKeyExchange';
