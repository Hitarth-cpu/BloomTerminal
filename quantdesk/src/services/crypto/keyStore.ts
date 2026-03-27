/**
 * IndexedDB-backed key store for CryptoKey objects.
 *
 * CryptoKey objects are stored directly — the structured-clone algorithm
 * handles them natively, so no serialisation is needed. Non-extractable keys
 * stay non-extractable: the browser never exposes raw key bytes to JavaScript.
 *
 * Why IndexedDB and NOT localStorage?
 *   localStorage is synchronous and stores only strings — you'd have to export
 *   the key material as raw bytes to store it, which exposes the key to any XSS
 *   payload that can reach localStorage. IndexedDB stores CryptoKey objects
 *   opaquely; extractable:false keys cannot be read out even by JS running on
 *   the same origin.
 */

const DB_NAME = 'quantdesk_crypto_v1';
const DB_VERSION = 1;
const KEY_STORE = 'keys';

// ─── DB open ───────────────────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(KEY_STORE)) {
        req.result.createObjectStore(KEY_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Public API ────────────────────────────────────────────────────────────────
export async function storeKey(keyId: string, key: CryptoKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite');
    tx.objectStore(KEY_STORE).put(key, keyId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadKey(keyId: string): Promise<CryptoKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readonly');
    const req = tx.objectStore(KEY_STORE).get(keyId);
    req.onsuccess = () => resolve((req.result as CryptoKey) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteKey(keyId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite');
    tx.objectStore(KEY_STORE).delete(keyId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
