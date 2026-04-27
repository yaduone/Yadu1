/**
 * storage.js — Firebase Storage image provider
 *
 * Uploads product images to Firebase Storage and returns permanent public URLs.
 * Requires FIREBASE_STORAGE_BUCKET to be set in .env.
 *
 * uploadImages(files, req)  → Promise<string[]>   public CDN URLs
 * deleteImages(urls)        → Promise<void>
 */

const path = require('path');
const { logUpload, logDelete, logError, logSuccess } = require('./uploadDebug');

function getBucket() {
  const { bucket } = require('../config/firebase');
  return bucket;
}

/**
 * Upload multer memory-buffer files to Firebase Storage.
 * Returns an array of permanent public URLs.
 */
async function uploadImages(files) {
  const bucket = getBucket();
  const urls = [];

  logUpload('Starting upload', {
    fileCount: files.length,
    bucketName: bucket.name,
  });

  for (const file of files) {
    try {
      const ext      = path.extname(file.originalname).toLowerCase();
      const filename = `products/${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
      const fileRef  = bucket.file(filename);

      logUpload('Uploading file', {
        originalName: file.originalname,
        filename,
        size: file.buffer.length,
        mimetype: file.mimetype,
      });

      await fileRef.save(file.buffer, {
        metadata: { contentType: file.mimetype },
      });

      logUpload('File saved to storage', { filename });

      // Make the file publicly readable so any client can load it directly
      await fileRef.makePublic();

      logUpload('File made public', { filename });

      const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
      urls.push(url);

      logSuccess('File uploaded successfully', {
        filename,
        url,
      });
    } catch (err) {
      logError('Failed to upload file', err, {
        originalName: file.originalname,
        size: file.buffer.length,
      });
      throw err;
    }
  }

  logSuccess('All files uploaded', {
    fileCount: urls.length,
    urls,
  });

  return urls;
}

/**
 * Delete images from Firebase Storage by their public URLs.
 * Silently ignores files that are already gone.
 */
async function deleteImages(urls = []) {
  const bucket = getBucket();

  logDelete('Starting deletion', {
    urlCount: urls.length,
  });

  for (const url of urls) {
    try {
      const match = url.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
      if (match) {
        const filename = decodeURIComponent(match[1]);
        
        logDelete('Deleting file', { filename, url });

        await bucket.file(filename).delete();

        logSuccess('File deleted', { filename });
      } else {
        logDelete('Could not parse filename from URL', { url });
      }
    } catch (err) {
      // Silently ignore - file may already be deleted
      logDelete('File deletion failed (ignoring)', {
        url,
        error: err.message,
      });
    }
  }

  logSuccess('Deletion complete', { urlCount: urls.length });
}

module.exports = { uploadImages, deleteImages };
