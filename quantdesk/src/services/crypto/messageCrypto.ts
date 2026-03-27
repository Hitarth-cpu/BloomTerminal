/**
 * AES-256-GCM message encryption via Web Crypto API (SubtleCrypto).
 *
 * Spec:
 *   Algorithm  : AES-256-GCM
 *   Key size   : 256 bits (32 bytes)
 *   IV/Nonce   : 96 bits  (12 bytes) — crypto.getRandomValues(), unique per message
 *   Auth tag   : 128 bits (16 bytes) — appended to ciphertext by SubtleCrypto
 *   AAD        : JSON-encoded { chatId, senderId } — authenticated, NOT encrypted
 *   Encoding   : IV + ciphertext(+tag) serialised as Base64
 *
 * The server relay NEVER sees plaintext — only EncryptedPayload crosses the wire.
 */

// ─── Wire format ───────────────────────────────────────────────────────────────
export interface EncryptedPayload {
  /** Schema version — always 1. */
  v: 1;
  /** Base64-encoded 12-byte IV (random per message). */
  iv: string;
  /**
   * Base64-encoded ciphertext.
   * SubtleCrypto AES-GCM appends the 128-bit auth tag to the ciphertext buffer,
   * so `ct` is (plaintext_length + 16) bytes long.
   */
  ct: string;
  /** Additional Authenticated Data — transmitted in the clear but MAC'd by GCM. */
  aad: {
    chatId: string;
    senderId: string;
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ─── Encrypt ───────────────────────────────────────────────────────────────────
/**
 * Encrypts `plaintext` with AES-256-GCM.
 *
 * A fresh 12-byte IV is generated via `crypto.getRandomValues()` for every call —
 * IV reuse with the same key catastrophically breaks GCM confidentiality.
 *
 * The chat room ID and sender ID are bound to the ciphertext as AAD so that
 * routing-level tampering (replaying a message to a different chat, spoofing
 * the sender field) is detectable and rejected at decrypt time.
 */
export async function encryptMessage(
  plaintext: string,
  key: CryptoKey,
  aad: { chatId: string; senderId: string },
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const additionalData = new TextEncoder().encode(JSON.stringify(aad));

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData, tagLength: 128 },
    key,
    encoded,
  );

  return {
    v: 1,
    iv: toBase64(iv.buffer as ArrayBuffer),
    ct: toBase64(ciphertextBuf),
    aad,
  };
}

// ─── Decrypt ───────────────────────────────────────────────────────────────────
/**
 * Decrypts an EncryptedPayload.
 *
 * SubtleCrypto verifies the 128-bit GCM authentication tag before returning
 * any plaintext. If the tag is invalid — wrong key, tampered ciphertext, or
 * mismatched AAD — `subtle.decrypt` throws a `DOMException` and this function
 * propagates it. Callers MUST treat any thrown error as a hard rejection:
 * do not display partial content.
 */
export async function decryptMessage(
  payload: EncryptedPayload,
  key: CryptoKey,
): Promise<string> {
  const iv = new Uint8Array(fromBase64(payload.iv));
  const ct = fromBase64(payload.ct);
  const additionalData = new TextEncoder().encode(JSON.stringify(payload.aad));

  // Will throw DOMException if tag verification fails — do NOT catch here.
  const plaintextBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData, tagLength: 128 },
    key,
    ct,
  );

  return new TextDecoder().decode(plaintextBuf);
}
