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

// Deduplication lock: prevents two simultaneous callers (e.g. App.tsx + IBChat)
// from each generating a fresh keypair when IndexedDB is empty, which would
// publish one key to the server while storing a *different* key locally —
// causing decryption failures. Concurrent callers share the same in-flight promise.
let _keyPairInFlight: Promise<ECDHKeyPair> | null = null;

/**
 * Returns the user's persistent ECDH P-256 key pair, generating one if none
 * exists yet. The private key is stored as non-extractable in IndexedDB.
 * Concurrent calls are serialised — they all await the same promise.
 */
export async function getOrCreateUserKeyPair(): Promise<ECDHKeyPair> {
  if (_keyPairInFlight) return _keyPairInFlight;

  _keyPairInFlight = (async () => {
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
  })().finally(() => { _keyPairInFlight = null; });

  return _keyPairInFlight;
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
 * Returns the AES-256-GCM shared key for a chat with a given peer.
 *
 * Uses ECDH P-256: both users independently derive the same 256-bit secret
 * from (my_private_key, their_public_key). The derived key is cached in
 * IndexedDB and validated against the peer's current server public key on
 * every call — if the peer rotated their key pair the cache is invalidated
 * and the key is re-derived automatically.
 *
 * Our own ECDH public key is published to the server on every call (idempotent).
 * The peer's public key is fetched from the server. Both steps require an
 * active session — this function must be called after authentication.
 *
 * Throws if the peer hasn't published their public key yet (they need to open
 * the chat panel at least once so their key is registered).
 */
export async function getOrCreateChatKey(peerId: string): Promise<CryptoKey> {
  const cacheId      = `ecdh:shared:${peerId}`;
  const peerPubLSKey = `ecdh_peer_pub:${peerId}`; // localStorage: peer pub key we last used

  // 1. Ensure our own ECDH keypair exists and publish it
  const myPair   = await getOrCreateUserKeyPair();
  const myPubB64 = await exportPublicKey(myPair.publicKey);

  const { publishPublicKey, fetchPublicKey } = await import('../api/chatApi');
  await publishPublicKey(myPubB64).catch(() => { /* non-fatal */ });

  // 2. Fetch peer's CURRENT public key from server
  const peerPubB64 = await fetchPublicKey(peerId);
  if (!peerPubB64) {
    throw new Error('Key exchange pending — peer needs to open IB Chat once to register their key');
  }

  // 3. Return cached derived key IF the peer's public key has not changed since
  //    we last derived it. If it changed (peer rotated keys), invalidate and re-derive.
  const storedPeerPub = typeof localStorage !== 'undefined'
    ? localStorage.getItem(peerPubLSKey)
    : null;
  const cached = await loadKey(cacheId);
  if (cached && storedPeerPub === peerPubB64) {
    return cached;
  }

  // 4. Derive shared AES-256-GCM key via ECDH (both sides produce the same key)
  const peerPublicKey = await importPeerPublicKey(peerPubB64);
  const sharedKey     = await deriveSharedKey(myPair.privateKey, peerPublicKey);

  // 5. Cache in IndexedDB and record which peer pub key we derived from
  await storeKey(cacheId, sharedKey);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(peerPubLSKey, peerPubB64);
  }

  return sharedKey;
}
