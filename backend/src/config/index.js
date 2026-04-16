require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account-key.json',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: '24h',
  },
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
  manifestCutoffHour: parseInt(process.env.MANIFEST_CUTOFF_HOUR, 10) || 21,
  manifestCronHour: parseInt(process.env.MANIFEST_CRON_HOUR, 10) || 23,
  milkTypes: ['cow', 'buffalo', 'toned'],
  productCategories: ['curd', 'paneer', 'butter_milk', 'ghee', 'butter', 'lassi', 'cream', 'cheese'],
};

module.exports = config;
