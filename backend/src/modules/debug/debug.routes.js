/**
 * Debug Routes
 * Provides diagnostic endpoints for troubleshooting
 * 
 * Only available in development mode
 */

const express = require('express');
const router = express.Router();
const { db, bucket, admin } = require('../../config/firebase');
const { success, badRequest } = require('../../utils/response');
const { getUploadLogs, clearUploadLogs } = require('../../utils/uploadDebug');

// Middleware: Only allow in development
router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return badRequest(res, 'Debug endpoints not available in production');
  }
  next();
});

// GET /api/debug/status — Check Firebase connectivity
router.get('/status', async (req, res, next) => {
  try {
    const status = {
      firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        initialized: !!admin.apps?.length,
      },
      firestore: { connected: false },
      storage: { connected: false, bucketName: null },
      timestamp: new Date().toISOString(),
    };

    // Test Firestore
    try {
      await db.collection('_debug').doc('test').get();
      status.firestore.connected = true;
    } catch (err) {
      status.firestore.error = err.message;
    }

    // Test Storage
    try {
      status.storage.bucketName = bucket.name;
      const [files] = await bucket.getFiles({ maxResults: 1 });
      status.storage.connected = true;
      status.storage.fileCount = files.length;
    } catch (err) {
      status.storage.error = err.message;
    }

    return success(res, status);
  } catch (err) { next(err); }
});

// GET /api/debug/storage — List files in storage
router.get('/storage', async (req, res, next) => {
  try {
    const prefix = req.query.prefix || 'products/';
    const limit = parseInt(req.query.limit || '50', 10);

    const [files] = await bucket.getFiles({
      prefix,
      maxResults: limit,
    });

    const fileList = files.map(f => ({
      name: f.name,
      size: f.metadata?.size,
      contentType: f.metadata?.contentType,
      timeCreated: f.metadata?.timeCreated,
      updated: f.metadata?.updated,
      publicUrl: `https://storage.googleapis.com/${bucket.name}/${f.name}`,
    }));

    return success(res, {
      prefix,
      count: fileList.length,
      files: fileList,
    });
  } catch (err) { next(err); }
});

// GET /api/debug/products — List products with image info
router.get('/products', async (req, res, next) => {
  try {
    const snap = await db.collection('products').limit(50).get();
    const products = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        imageCount: Array.isArray(data.images) ? data.images.length : 0,
        images: data.images || [],
        created_at: data.created_at,
      };
    });

    return success(res, {
      count: products.length,
      products,
    });
  } catch (err) { next(err); }
});

// GET /api/debug/logs — Get upload logs
router.get('/logs', async (req, res, next) => {
  try {
    const lines = parseInt(req.query.lines || '100', 10);
    const logs = getUploadLogs(lines);

    return success(res, {
      count: logs.length,
      logs: logs.map(l => {
        try {
          return JSON.parse(l);
        } catch {
          return { raw: l };
        }
      }),
    });
  } catch (err) { next(err); }
});

// DELETE /api/debug/logs — Clear upload logs
router.delete('/logs', async (req, res, next) => {
  try {
    clearUploadLogs();
    return success(res, null, 'Logs cleared');
  } catch (err) { next(err); }
});

// POST /api/debug/test-upload — Test upload functionality
router.post('/test-upload', async (req, res, next) => {
  try {
    const testFilename = `_debug/test-${Date.now()}.txt`;
    const testFile = bucket.file(testFilename);

    // Upload
    await testFile.save('Test upload at ' + new Date().toISOString(), {
      metadata: { contentType: 'text/plain' },
    });

    // Make public
    await testFile.makePublic();

    // Get metadata
    const [metadata] = await testFile.getMetadata();

    // Cleanup
    await testFile.delete();

    return success(res, {
      message: 'Upload test successful',
      filename: testFilename,
      metadata: {
        size: metadata.size,
        contentType: metadata.contentType,
        timeCreated: metadata.timeCreated,
      },
      publicUrl: `https://storage.googleapis.com/${bucket.name}/${testFilename}`,
    });
  } catch (err) { next(err); }
});

// GET /api/debug/verify-image/:productId — Verify product images
router.get('/verify-image/:productId', async (req, res, next) => {
  try {
    const productRef = db.collection('products').doc(req.params.productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      return badRequest(res, 'Product not found');
    }

    const product = productDoc.data();
    const images = Array.isArray(product.images) ? product.images : [];

    const verification = await Promise.all(
      images.map(async (url) => {
        try {
          const match = url.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
          if (!match) {
            return { url, status: 'invalid_url' };
          }

          const filename = decodeURIComponent(match[1]);
          const [exists] = await bucket.file(filename).exists();
          const [metadata] = exists ? await bucket.file(filename).getMetadata() : [null];

          return {
            url,
            status: exists ? 'exists' : 'missing',
            filename,
            size: metadata?.size,
            contentType: metadata?.contentType,
          };
        } catch (err) {
          return { url, status: 'error', error: err.message };
        }
      })
    );

    return success(res, {
      productId: req.params.productId,
      productName: product.name,
      imageCount: images.length,
      verification,
    });
  } catch (err) { next(err); }
});

module.exports = router;
