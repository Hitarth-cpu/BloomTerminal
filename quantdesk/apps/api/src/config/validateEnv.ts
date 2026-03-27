export function validateEnv() {
  const REQUIRED = [
    'DATABASE_URL',
    'REDIS_URL',
    'MONGO_URL',
    'JWT_SECRET',
    'GEMINI_API_KEY',
  ];

  // Firebase: either FIREBASE_SERVICE_ACCOUNT_JSON or all three individual vars
  const hasServiceAccountJson = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const hasIndividualVars =
    !!process.env.FIREBASE_PROJECT_ID &&
    !!process.env.FIREBASE_CLIENT_EMAIL &&
    !!process.env.FIREBASE_PRIVATE_KEY;

  const missing = REQUIRED.filter(key => !process.env[key]);

  if (!hasServiceAccountJson && !hasIndividualVars) {
    missing.push('FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)');
  }

  if (missing.length > 0) {
    console.error('❌ Missing required env vars:');
    missing.forEach(k => console.error(`   - ${k}`));
    // Warn but don't exit — allow running with partial config in dev
    if (process.env.NODE_ENV === 'production') process.exit(1);
  } else {
    console.log('✅ Environment variables validated');
  }
}
