/**
 * Auth service — Firebase Authentication with mock fallback.
 *
 * If VITE_FIREBASE_API_KEY is set in .env.local, real Firebase auth is used
 * (Google OAuth popup + email/password). Otherwise every call succeeds with
 * a mock user so the UI is fully functional during dev without a Firebase project.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from 'firebase/auth';
import type { AuthUser } from '../../stores/authStore';
import { useAuthStore } from '../../stores/authStore';

const firebaseConfig = {
  apiKey:     import.meta.env.VITE_FIREBASE_API_KEY     as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID  as string | undefined,
  appId:      import.meta.env.VITE_FIREBASE_APP_ID      as string | undefined,
};

const isConfigured = !!(firebaseConfig.apiKey && firebaseConfig.authDomain);

let app: FirebaseApp | null = null;
if (isConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    // Initialize with whatever config is available (even partial) so getAuth() works
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

// ─── Mock user factory (dev only) ─────────────────────────────────────────────
function mockUser(email: string, displayName?: string): AuthUser {
  return {
    uid: `mock_${btoa(email).slice(0, 12)}`,
    email,
    displayName: displayName ?? email.split('@')[0],
    photoURL: null,
    provider: 'mock',
  };
}

// ─── Persist user to backend DB ───────────────────────────────────────────────
async function syncToBackend(user: AuthUser, idToken?: string, firm?: string): Promise<string | null> {
  try {
    const url  = idToken ? '/api/auth/login' : '/api/auth/dev-login';
    const body = idToken
      ? { idToken }
      : { uid: user.uid, email: user.email, name: user.displayName, picture: user.photoURL, ...(firm ? { firm } : {}) };

    const res  = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json() as { token?: string };
    return data.token ?? null;
  } catch {
    console.warn('[auth] Backend sync failed (API not running?)');
    return null;
  }
}

// ─── Google sign-in ────────────────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<AuthUser> {
  if (!isConfigured || !app) {
    await new Promise(r => setTimeout(r, 600));
    const user  = mockUser('demo@quantdesk.io', 'Demo Trader');
    const token = await syncToBackend(user);
    useAuthStore.getState().setUser(user, token ?? undefined);
    return user;
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  const result = await signInWithPopup(getAuth(app), provider);
  const user: AuthUser = {
    uid:         result.user.uid,
    email:       result.user.email,
    displayName: result.user.displayName,
    photoURL:    result.user.photoURL,
    provider:    'google',
  };
  const idToken = await result.user.getIdToken();
  const token   = await syncToBackend(user, idToken);
  useAuthStore.getState().setUser(user, token ?? idToken);
  return user;
}

// ─── Email / password sign-in ──────────────────────────────────────────────────
export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  if (!isConfigured || !app) {
    if (!password) throw new Error('Password required');
    await new Promise(r => setTimeout(r, 500));
    const user  = mockUser(email);
    const token = await syncToBackend(user);
    useAuthStore.getState().setUser(user, token ?? undefined);
    return user;
  }

  const result = await signInWithEmailAndPassword(getAuth(app), email, password);
  const user: AuthUser = {
    uid:         result.user.uid,
    email:       result.user.email,
    displayName: result.user.displayName,
    photoURL:    result.user.photoURL,
    provider:    'email',
  };
  const idToken = await result.user.getIdToken();
  const token   = await syncToBackend(user, idToken);
  useAuthStore.getState().setUser(user, token ?? idToken);
  return user;
}

// ─── Create account ────────────────────────────────────────────────────────────
export async function createAccount(
  email: string,
  password: string,
  displayName: string,
  firm?: string,
): Promise<AuthUser> {
  if (!isConfigured || !app) {
    if (password.length < 8) throw new Error('Password must be at least 8 characters');
    await new Promise(r => setTimeout(r, 700));
    const user  = mockUser(email, displayName);
    const token = await syncToBackend(user, undefined, firm);
    useAuthStore.getState().setUser(user, token ?? undefined);
    return user;
  }

  const result = await createUserWithEmailAndPassword(getAuth(app), email, password);
  await updateProfile(result.user, { displayName });
  const user: AuthUser = {
    uid:         result.user.uid,
    email:       result.user.email,
    displayName,
    photoURL:    null,
    provider:    'email',
  };
  const idToken = await result.user.getIdToken();
  const token   = await syncToBackend(user, idToken, firm);
  useAuthStore.getState().setUser(user, token ?? idToken);
  return user;
}

// ─── Sign out ──────────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  if (!isConfigured || !app) return;
  await firebaseSignOut(getAuth(app));
}

// ─── Auth state listener (for Firebase session persistence) ───────────────────
export function onAuthStateChanged(cb: (user: AuthUser | null) => void): () => void {
  if (!isConfigured || !app) return () => {};

  return firebaseOnAuthStateChanged(getAuth(app), async (fbUser) => {
    if (!fbUser) { cb(null); return; }
    const user: AuthUser = {
      uid:         fbUser.uid,
      email:       fbUser.email,
      displayName: fbUser.displayName,
      photoURL:    fbUser.photoURL,
      provider:    fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
    };
    // Refresh the backend token on every auth state change (page reload, token refresh)
    const idToken = await fbUser.getIdToken().catch(() => null);
    if (idToken) {
      const token = await syncToBackend(user, idToken);
      useAuthStore.getState().setUser(user, token ?? idToken);
    } else {
      useAuthStore.getState().setUser(user, undefined);
    }
    cb(user);
  });
}
