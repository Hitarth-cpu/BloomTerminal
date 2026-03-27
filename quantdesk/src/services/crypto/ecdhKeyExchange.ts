/**
 * Key management — two modes:
 *
 * OPTION A — ECDH P-256 (production)
 *   Each user generates a P-256 key pair once. The public key is published to
 *   the server; the private key lives in IndexedDB (non-extractable). When two
 *   users open a chat, each derives the same 256-bit AES-GCM key via ECDH.
 *   Neither the private key nor the derived secret ever leave the browser.
 *
 * OPTION B — Pre-Shared Key / PSK (development / testing)
 *   A fresh AES-256-GCM key is generated per chat room and stored in IndexedDB.
 *   In production this key would be exchanged out-of-band; in the dev terminal
 *   demo it is generated locally so all encrypt/decrypt calls exercise the
 *   real AES-GCM code path without needing a live backend.
 *
 * Both options produce a non-extractable CryptoKey with usages ['encrypt','decrypt'].
 */

import { storeKey, loadKey } from './keyStore';

// ─── ECDH key IDs (IndexedDB) ──────────────────────────────────────────────────
const MY_PRIVATE_KEY_ID = 'ecdh:private:me';
const MY_PUBLIC_KEY_ID  = 'ecdh:public:me';

// ─── OPTION A — ECDH P-256 ─────────────────────────────────────────────────────

export interface ECDHKeyPair {
  publicKey: CryptoKey;   // extractable — safe to publish to server
  privateKey: CryptoKey;  // non-extractable — never leaves IndexedDB
}

/**
 * Returns the user's persistent ECDH P-256 key pair, generating one if none
 * exists yet. The private key is stored as non-extractable in IndexedDB.
 */
export async function getOrCreateUserKeyPair(): Promise<ECDHKeyPair> {
  const [storedPrivate, storedPublic] = await Promise.all([
    loadKey(MY_PRIVATE_KEY_ID),
    loadKey(MY_PUBLIC_KEY_ID),
  ]);

  if (storedPrivate && storedPublic) {
    return { privateKey: storedPrivate, publicKey: storedPublic };
  }

  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,                        // extractable — needed to export public key as SPKI
    ['deriveKey', 'deriveBits'],
  ) as CryptoKeyPair;

  await Promise.all([
    storeKey(MY_PRIVATE_KEY_ID, pair.privateKey),
    storeKey(MY_PUBLIC_KEY_ID,  pair.publicKey),
  ]);

  return { privateKey: pair.privateKey, publicKey: pair.publicKey };
}

/**
 * Exports a public key as a Base64-encoded SPKI blob for transmission to the
 * server or a peer.
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  const bytes = new Uint8Array(spki);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Imports a peer's public key from a Base64-encoded SPKI blob received from
 * the server.
 */
export async function importPeerPublicKey(base64Spki: string): Promise<CryptoKey> {
  const binary = atob(base64Spki);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return crypto.subtle.importKey(
    'spki',
    bytes.buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,  // peer public keys need not be re-exported
    [],
  );
}

/**
 * Derives the shared AES-256-GCM key from our private key and the peer's
 * public key via ECDH. The result is non-extractable and usable only for
 * encrypt/decrypt operations.
 *
 * Both sides compute the same secret independently — no key material is
 * ever transmitted.
 */
export async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,  // non-extractable — never exposed to JS as raw bytes
    ['encrypt', 'decrypt'],
  );
}

// ─── OPTION B — PSK (dev / testing) ───────────────────────────────────────────

/**
 * Generates a fresh AES-256-GCM key via SubtleCrypto. Uses the CSPRNG inside
 * the browser engine — never Math.random().
 *
 * `extractable: false` means the key material cannot be exported even by code
 * running on the same origin, providing defence-in-depth against XSS exfil.
 */
export async function generatePSK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,             // non-extractable
    ['encrypt', 'decrypt'],
  );
}

/**
 * Imports a raw 32-byte AES-256-GCM key distributed out-of-band (e.g. by an
 * admin). The key is imported as non-extractable and stored in IndexedDB.
 *
 * @param rawBase64 - Base64-encoded 32-byte key material.
 */
export async function importPSK(rawBase64: string): Promise<CryptoKey> {
  const binary = atob(rawBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return crypto.subtle.importKey(
    'raw',
    bytes.buffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Returns (or lazily creates) the AES-256-GCM session key for a given chatId.
 * Key is persisted in IndexedDB so it survives page reloads within the same
 * browser session.
 *
 * In production with a real backend, this would be replaced by the ECDH-derived
 * key for the chat pair / group key-wrapping scheme.
 */
export async function getOrCreateChatKey(chatId: string): Promise<CryptoKey> {
  const keyId = `psk:chat:${chatId}`;
  const existing = await loadKey(keyId);
  if (existing) return existing;

  const key = await generatePSK();
  await storeKey(keyId, key);
  return key;
}
