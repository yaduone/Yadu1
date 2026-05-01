require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account-key.json',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
  },
  jwt: {
    secret: (() => {
      const secret = process.env.JWT_SECRET;
      if (!secret || secret === 'dev-secret-change-me') {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET environment variable must be set in production');
        }
        return secret || 'dev-secret-change-me';
      }
      return secret;
    })(),
    expiresIn: '24h',
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean),
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  manifestCutoffHour: parseInt(process.env.MANIFEST_CUTOFF_HOUR, 10) || 21,
  manifestCronHour: parseInt(process.env.MANIFEST_CRON_HOUR, 10) || 23,
  milkTypes: ['cow', 'buffalo', 'toned'],
  productCategories: ['curd', 'paneer', 'butter_milk', 'ghee', 'butter', 'lassi', 'cream', 'cheese'],
};

module.exports = config;
