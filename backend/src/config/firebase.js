const admin = require('firebase-admin');
const path = require('path');
const config = require('./index');

const serviceAccountPath = path.resolve(__dirname, '../../', config.firebase.serviceAccountPath);

let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch (err) {
  console.warn('WARNING: Firebase service account key not found at', serviceAccountPath);
  console.warn('Run the seed script after placing the service account key file.');
  console.warn('Continuing with project ID only (some features may not work)...\n');
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: config.firebase.projectId,
  });
} else if (config.firebase.projectId) {
  admin.initializeApp({
    projectId: config.firebase.projectId,
  });
} else {
  console.error('ERROR: No Firebase project ID configured. Set FIREBASE_PROJECT_ID in .env');
  process.exit(1);
}

const db = admin.firestore();

module.exports = { admin, db };
