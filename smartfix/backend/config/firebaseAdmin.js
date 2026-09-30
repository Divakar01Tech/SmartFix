/**
 * Firebase Admin SDK — lazy initialization
 *
 * Initialized on first use (not on require) so that dotenv has already
 * populated process.env by the time we read FIREBASE_PROJECT_ID.
 *
 * verifyIdToken() fetches Google's public RSA keys via HTTPS — no
 * service-account.json is required for this operation.
 */
const admin = require('firebase-admin');

let _app = null;

function getApp() {
  if (_app) return _app;

  // Reuse if another part of the app already initialized firebase-admin
  if (admin.apps && admin.apps.length > 0) {
    _app = admin.apps[0];
    return _app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'smartfix-37bc7';

  // Optional: load service-account.json for full Admin privileges
  const saFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  if (saFile) {
    try {
      const path = require('path');
      const fs   = require('fs');
      const fullPath = path.resolve(__dirname, '..', saFile);
      if (fs.existsSync(fullPath)) {
        const sa = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        _app = admin.initializeApp({
          credential: admin.credential.cert(sa),
          projectId,
        });
        console.log('✅ Firebase Admin: initialized with service-account.json');
        return _app;
      }
    } catch (e) {
      console.warn('⚠️  Firebase Admin: service-account.json load failed:', e.message);
    }
  }

  // Fallback: projectId-only mode — sufficient for verifyIdToken()
  // (Firebase Admin fetches Google public keys over HTTPS to validate JWTs)
  _app = admin.initializeApp({ projectId });
  console.log(`✅ Firebase Admin: initialized (project=${projectId})`);
  return _app;
}

const { getAuth } = require('firebase-admin/auth');

/**
 * Verify a Firebase Google ID token.
 * @param {string} idToken
 * @returns {Promise<admin.auth.DecodedIdToken>}
 */
async function verifyIdToken(idToken) {
  return getAuth(getApp()).verifyIdToken(idToken);
}

module.exports = { getApp, verifyIdToken, admin };
