const admin = require('firebase-admin');
const path = require('path');
const config = require('./index');

const serviceAccountPath = path.resolve(__dirname, '../../', config.firebase.serviceAccountPath);

let serviceAccount;

// Cloud deployments: service account JSON encoded as base64 env var
// Local development: loaded from file path
if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  try {
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decoded);
  } catch (err) {
    console.error('ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', err.message);
    process.exit(1);
  }
} else {
  try {
    serviceAccount = require(serviceAccountPath);
  } catch (err) {
    console.warn('WARNING: Firebase service account key not found at', serviceAccountPath);
    console.warn('Set FIREBASE_SERVICE_ACCOUNT_BASE64 env var for cloud deployments.\n');
  }
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: config.firebase.projectId,
    storageBucket: config.firebase.storageBucket,
  });
} else if (config.firebase.projectId) {
  admin.initializeApp({
    projectId: config.firebase.projectId,
    storageBucket: config.firebase.storageBucket,
  });
} else {
  console.error('ERROR: No Firebase project ID configured. Set FIREBASE_PROJECT_ID in .env');
  process.exit(1);
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { admin, db, bucket };
