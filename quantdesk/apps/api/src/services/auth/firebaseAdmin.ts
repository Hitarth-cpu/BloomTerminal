import * as admin from 'firebase-admin';

let _app: admin.app.App | null = null;

function getApp(): admin.app.App {
  if (_app) return _app;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccount) {
    _app = admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    _app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    // Dev mode: no Firebase credentials — verifyIdToken will always reject real tokens
    console.warn('[firebase-admin] No service account configured — running in mock mode');
    _app = admin.initializeApp({ projectId: 'quantdesk-dev' });
  }

  return _app;
}

export interface DecodedToken {
  uid:     string;
  email?:  string;
  name?:   string;
  picture?: string;
  iat:     number;
  exp:     number;
}

export async function verifyIdToken(idToken: string): Promise<DecodedToken> {
  const app = getApp();
  const decoded = await admin.auth(app).verifyIdToken(idToken, /* checkRevoked */ true);
  return {
    uid:     decoded.uid,
    email:   decoded.email,
    name:    decoded.name,
    picture: decoded.picture,
    iat:     decoded.iat,
    exp:     decoded.exp,
  };
}

export async function revokeRefreshTokens(uid: string): Promise<void> {
  const app = getApp();
  await admin.auth(app).revokeRefreshTokens(uid);
}
