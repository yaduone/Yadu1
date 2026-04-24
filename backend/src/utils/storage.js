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

  for (const file of files) {
    const ext      = path.extname(file.originalname).toLowerCase();
    const filename = `products/${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const fileRef  = bucket.file(filename);

    await fileRef.save(file.buffer, {
      metadata: { contentType: file.mimetype },
    });

    // Make the file publicly readable so any client can load it directly
    await fileRef.makePublic();

    urls.push(`https://storage.googleapis.com/${bucket.name}/${filename}`);
  }

  return urls;
}

/**
 * Delete images from Firebase Storage by their public URLs.
 * Silently ignores files that are already gone.
 */
async function deleteImages(urls = []) {
  const bucket = getBucket();

  for (const url of urls) {
    try {
      const match = url.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
      if (match) {
        await bucket.file(decodeURIComponent(match[1])).delete();
      }
    } catch (_) { /* already deleted or never existed */ }
  }
}

module.exports = { uploadImages, deleteImages };
