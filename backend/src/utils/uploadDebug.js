/**
 * Upload Debug Utility
 * Provides detailed logging for image upload operations
 * 
 * Usage:
 * const { logUpload, logDelete } = require('./uploadDebug');
 * logUpload('Starting upload', { filename, size });
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'uploads.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getTimestamp() {
  return new Date().toISOString();
}

function formatLog(level, message, data = {}) {
  return JSON.stringify({
    timestamp: getTimestamp(),
    level,
    message,
    ...data,
  });
}

function writeLog(entry) {
  try {
    fs.appendFileSync(LOG_FILE, entry + '\n');
  } catch (err) {
    console.error('Failed to write upload log:', err.message);
  }
}

function logUpload(message, data = {}) {
  const entry = formatLog('UPLOAD', message, data);
  writeLog(entry);
  console.log(`[UPLOAD] ${message}`, data);
}

function logDelete(message, data = {}) {
  const entry = formatLog('DELETE', message, data);
  writeLog(entry);
  console.log(`[DELETE] ${message}`, data);
}

function logError(message, error, data = {}) {
  const entry = formatLog('ERROR', message, {
    error: error.message,
    stack: error.stack,
    ...data,
  });
  writeLog(entry);
  console.error(`[ERROR] ${message}`, error.message, data);
}

function logSuccess(message, data = {}) {
  const entry = formatLog('SUCCESS', message, data);
  writeLog(entry);
  console.log(`[SUCCESS] ${message}`, data);
}

function getUploadLogs(lines = 100) {
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    return content.split('\n').slice(-lines).filter(l => l.trim());
  } catch (err) {
    return [];
  }
}

function clearUploadLogs() {
  try {
    fs.writeFileSync(LOG_FILE, '');
    console.log('Upload logs cleared');
  } catch (err) {
    console.error('Failed to clear logs:', err.message);
  }
}

module.exports = {
  logUpload,
  logDelete,
  logError,
  logSuccess,
  getUploadLogs,
  clearUploadLogs,
  LOG_FILE,
};
