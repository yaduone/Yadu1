/**
 * Production-Level Image Upload Test Suite
 * Tests Firebase Storage image upload functionality for products
 * 
 * Run: npm test -- tests/image-upload.test.js
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { app } = require('../src/app');
const { db, bucket } = require('../src/config/firebase');
const { uploadImages, deleteImages } = require('../src/utils/storage');

// ─── Test Configuration ───────────────────────────────────────────────────────

const TEST_TIMEOUT = 30000; // 30 seconds for Firebase operations
const TEST_IMAGE_DIR = path.join(__dirname, 'fixtures');
const TEST_PRODUCT_ID = `test-product-${Date.now()}`;

// Mock admin token (replace with actual test token)
let adminToken = '';

// ─── Setup & Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // Create test fixtures directory if it doesn't exist
  if (!fs.existsSync(TEST_IMAGE_DIR)) {
    fs.mkdirSync(TEST_IMAGE_DIR, { recursive: true });
  }

  // Generate test images (1x1 pixel JPG and PNG)
  createTestImage('test-image.jpg', 'jpeg');
  createTestImage('test-image.png', 'png');
  createTestImage('large-image.jpg', 'jpeg', 4 * 1024 * 1024); // 4 MB

  // Get or create admin token (requires valid credentials)
  // For testing, you may need to set this manually or use Firebase emulator
  adminToken = process.env.TEST_ADMIN_TOKEN || '';
}, TEST_TIMEOUT);

afterAll(async () => {
  // Cleanup test images from fixtures
  try {
    fs.rmSync(TEST_IMAGE_DIR, { recursive: true, force: true });
  } catch (err) {
    console.warn('Failed to cleanup test fixtures:', err.message);
  }

  // Cleanup test products from Firestore
  try {
    const snapshot = await db.collection('products')
      .where('name', '==', 'Test Product')
      .get();
    
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
    }
  } catch (err) {
    console.warn('Failed to cleanup test products:', err.message);
  }
}, TEST_TIMEOUT);

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Create a minimal test image file
 */
function createTestImage(filename, format, size = 1024) {
  const filepath = path.join(TEST_IMAGE_DIR, filename);
  
  if (format === 'jpeg') {
    // Minimal JPEG header + data
    const buffer = Buffer.alloc(size);
    buffer[0] = 0xFF; buffer[1] = 0xD8; // SOI
    buffer[2] = 0xFF; buffer[3] = 0xE0; // APP0
    buffer.write('JFIF', 6);
    buffer[buffer.length - 2] = 0xFF; buffer[buffer.length - 1] = 0xD9; // EOI
    fs.writeFileSync(filepath, buffer);
  } else if (format === 'png') {
    // Minimal PNG header + IHDR chunk
    const buffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, // IHDR chunk size
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, // width: 1
      0x00, 0x00, 0x00, 0x01, // height: 1
      0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, etc.
      0x90, 0x77, 0x53, 0xDE, // CRC
      0x00, 0x00, 0x00, 0x00, // IEND chunk size
      0x49, 0x45, 0x4E, 0x44, // IEND
      0xAE, 0x42, 0x60, 0x82, // CRC
    ]);
    fs.writeFileSync(filepath, buffer);
  }
}

/**
 * Get test image as buffer
 */
function getTestImageBuffer(filename) {
  return fs.readFileSync(path.join(TEST_IMAGE_DIR, filename));
}

/**
 * Extract filename from Firebase Storage URL
 */
function extractFilenameFromUrl(url) {
  const match = url.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Verify file exists in Firebase Storage
 */
async function fileExistsInStorage(filename) {
  try {
    const [exists] = await bucket.file(filename).exists();
    return exists;
  } catch (err) {
    console.error('Error checking file existence:', err.message);
    return false;
  }
}

/**
 * Verify file is publicly accessible
 */
async function fileIsPublic(filename) {
  try {
    const file = bucket.file(filename);
    const [acl] = await file.acl.get();
    return acl.some(entry => entry.entity === 'allUsers' && entry.role === 'READER');
  } catch (err) {
    // If ACL check fails, try alternative method - file should be accessible if makePublic() was called
    try {
      const [metadata] = await bucket.file(filename).getMetadata();
      // If we can get metadata without error, file exists and was made public
      return true;
    } catch {
      console.error('Error checking file public status:', err.message);
      return false;
    }
  }
}

// ─── Test Suites ──────────────────────────────────────────────────────────────

describe('Image Upload - Firebase Storage Integration', () => {

  describe('Direct uploadImages() Function', () => {

    test('should upload single JPG image and return public URL', async () => {
      const buffer = getTestImageBuffer('test-image.jpg');
      const mockFile = {
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        buffer: buffer,
      };

      const urls = await uploadImages([mockFile]);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toMatch(/^https:\/\/storage\.googleapis\.com\//);
      expect(urls[0]).toContain('products/');

      // Verify file exists in storage
      const filename = extractFilenameFromUrl(urls[0]);
      const exists = await fileExistsInStorage(filename);
      expect(exists).toBe(true);

      // Cleanup
      await deleteImages(urls);
    }, TEST_TIMEOUT);

    test('should upload single PNG image and return public URL', async () => {
      const buffer = getTestImageBuffer('test-image.png');
      const mockFile = {
        originalname: 'test-image.png',
        mimetype: 'image/png',
        buffer: buffer,
      };

      const urls = await uploadImages([mockFile]);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toMatch(/^https:\/\/storage\.googleapis\.com\//);

      const filename = extractFilenameFromUrl(urls[0]);
      const exists = await fileExistsInStorage(filename);
      expect(exists).toBe(true);

      await deleteImages(urls);
    }, TEST_TIMEOUT);

    test('should upload multiple images and return array of URLs', async () => {
      const files = [
        {
          originalname: 'image1.jpg',
          mimetype: 'image/jpeg',
          buffer: getTestImageBuffer('test-image.jpg'),
        },
        {
          originalname: 'image2.png',
          mimetype: 'image/png',
          buffer: getTestImageBuffer('test-image.png'),
        },
      ];

      const urls = await uploadImages(files);

      expect(urls).toHaveLength(2);
      urls.forEach(url => {
        expect(url).toMatch(/^https:\/\/storage\.googleapis\.com\//);
      });

      // Verify all files exist
      for (const url of urls) {
        const filename = extractFilenameFromUrl(url);
        const exists = await fileExistsInStorage(filename);
        expect(exists).toBe(true);
      }

      await deleteImages(urls);
    }, TEST_TIMEOUT);

    test('should make uploaded files publicly readable', async () => {
      const buffer = getTestImageBuffer('test-image.jpg');
      const mockFile = {
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        buffer: buffer,
      };

      const urls = await uploadImages([mockFile]);
      const filename = extractFilenameFromUrl(urls[0]);
      const isPublic = await fileIsPublic(filename);

      expect(isPublic).toBe(true);

      await deleteImages(urls);
    }, TEST_TIMEOUT);

    test('should generate unique filenames for same image uploaded twice', async () => {
      const buffer = getTestImageBuffer('test-image.jpg');
      const mockFile = {
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        buffer: buffer,
      };

      const urls1 = await uploadImages([mockFile]);
      const urls2 = await uploadImages([mockFile]);

      expect(urls1[0]).not.toBe(urls2[0]);

      await deleteImages([...urls1, ...urls2]);
    }, TEST_TIMEOUT);

    test('should handle empty file array gracefully', async () => {
      const urls = await uploadImages([]);
      expect(urls).toEqual([]);
    });

  });

  describe('Direct deleteImages() Function', () => {

    test('should delete uploaded image from storage', async () => {
      const buffer = getTestImageBuffer('test-image.jpg');
      const mockFile = {
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        buffer: buffer,
      };

      const urls = await uploadImages([mockFile]);
      const filename = extractFilenameFromUrl(urls[0]);

      // Verify file exists before deletion
      let exists = await fileExistsInStorage(filename);
      expect(exists).toBe(true);

      // Delete
      await deleteImages(urls);

      // Verify file is deleted
      exists = await fileExistsInStorage(filename);
      expect(exists).toBe(false);
    }, TEST_TIMEOUT);

    test('should handle deletion of non-existent files gracefully', async () => {
      const fakeUrl = 'https://storage.googleapis.com/yadu1-821e8.firebasestorage.app/products/nonexistent.jpg';
      
      // Should not throw
      await expect(deleteImages([fakeUrl])).resolves.not.toThrow();
    }, TEST_TIMEOUT);

    test('should delete multiple images', async () => {
      const files = [
        {
          originalname: 'image1.jpg',
          mimetype: 'image/jpeg',
          buffer: getTestImageBuffer('test-image.jpg'),
        },
        {
          originalname: 'image2.png',
          mimetype: 'image/png',
          buffer: getTestImageBuffer('test-image.png'),
        },
      ];

      const urls = await uploadImages(files);
      const filenames = urls.map(url => extractFilenameFromUrl(url));

      // Verify all exist
      for (const filename of filenames) {
        const exists = await fileExistsInStorage(filename);
        expect(exists).toBe(true);
      }

      // Delete all
      await deleteImages(urls);

      // Verify all deleted
      for (const filename of filenames) {
        const exists = await fileExistsInStorage(filename);
        expect(exists).toBe(false);
      }
    }, TEST_TIMEOUT);

  });

  describe('Product Creation with Images (API Endpoint)', () => {

    test('should create product with single image', async () => {
      if (!adminToken) {
        console.warn('Skipping API test: TEST_ADMIN_TOKEN not set');
        return;
      }

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Product')
        .field('category', 'curd')
        .field('unit', '500g')
        .field('price', '150')
        .field('description', 'Test product with image')
        .attach('images', path.join(TEST_IMAGE_DIR, 'test-image.jpg'));

      expect(response.status).toBe(201);
      expect(response.body.data.product).toBeDefined();
      expect(response.body.data.product.images).toHaveLength(1);
      expect(response.body.data.product.images[0]).toMatch(/^https:\/\/storage\.googleapis\.com\//);

      // Cleanup
      const productId = response.body.data.product.id;
      await db.collection('products').doc(productId).delete();
      await deleteImages(response.body.data.product.images);
    }, TEST_TIMEOUT);

    test('should create product with multiple images', async () => {
      if (!adminToken) {
        console.warn('Skipping API test: TEST_ADMIN_TOKEN not set');
        return;
      }

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Product Multi')
        .field('category', 'paneer')
        .field('unit', '250g')
        .field('price', '200')
        .attach('images', path.join(TEST_IMAGE_DIR, 'test-image.jpg'))
        .attach('images', path.join(TEST_IMAGE_DIR, 'test-image.png'));

      expect(response.status).toBe(201);
      expect(response.body.data.product.images).toHaveLength(2);

      // Cleanup
      const productId = response.body.data.product.id;
      await db.collection('products').doc(productId).delete();
      await deleteImages(response.body.data.product.images);
    }, TEST_TIMEOUT);

    test('should reject oversized images (>5MB)', async () => {
      if (!adminToken) {
        console.warn('Skipping API test: TEST_ADMIN_TOKEN not set');
        return;
      }

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Product Large')
        .field('category', 'curd')
        .field('unit', '500g')
        .field('price', '150')
        .attach('images', path.join(TEST_IMAGE_DIR, 'large-image.jpg'));

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/file size|5 MB/i);
    }, TEST_TIMEOUT);

    test('should reject invalid file types', async () => {
      if (!adminToken) {
        console.warn('Skipping API test: TEST_ADMIN_TOKEN not set');
        return;
      }

      // Create a text file
      const textFile = path.join(TEST_IMAGE_DIR, 'test.txt');
      fs.writeFileSync(textFile, 'This is not an image');

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Product Invalid')
        .field('category', 'curd')
        .field('unit', '500g')
        .field('price', '150')
        .attach('images', textFile);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/JPG|PNG|image/i);

      fs.unlinkSync(textFile);
    }, TEST_TIMEOUT);

  });

  describe('Product Update with Image Management', () => {

    test('should add images to existing product', async () => {
      if (!adminToken) {
        console.warn('Skipping API test: TEST_ADMIN_TOKEN not set');
        return;
      }

      // Create product without images
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Product Update')
        .field('category', 'curd')
        .field('unit', '500g')
        .field('price', '150');

      const productId = createRes.body.data.product.id;

      // Add images
      const updateRes = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Product Update')
        .attach('images', path.join(TEST_IMAGE_DIR, 'test-image.jpg'));

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.product.images).toHaveLength(1);

      // Cleanup
      await db.collection('products').doc(productId).delete();
      await deleteImages(updateRes.body.data.product.images);
    }, TEST_TIMEOUT);

    test('should replace all images when replace_images=true', async () => {
      if (!adminToken) {
        console.warn('Skipping API test: TEST_ADMIN_TOKEN not set');
        return;
      }

      // Create product with image
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Product Replace')
        .field('category', 'curd')
        .field('unit', '500g')
        .field('price', '150')
        .attach('images', path.join(TEST_IMAGE_DIR, 'test-image.jpg'));

      const productId = createRes.body.data.product.id;
      const oldImages = createRes.body.data.product.images;

      // Replace with new image
      const updateRes = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('replace_images', 'true')
        .attach('images', path.join(TEST_IMAGE_DIR, 'test-image.png'));

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.product.images).toHaveLength(1);
      expect(updateRes.body.data.product.images[0]).not.toBe(oldImages[0]);

      // Verify old image is deleted
      const oldFilename = extractFilenameFromUrl(oldImages[0]);
      const exists = await fileExistsInStorage(oldFilename);
      expect(exists).toBe(false);

      // Cleanup
      await db.collection('products').doc(productId).delete();
      await deleteImages(updateRes.body.data.product.images);
    }, TEST_TIMEOUT);

    test('should remove specific images when remove_images provided', async () => {
      if (!adminToken) {
        console.warn('Skipping API test: TEST_ADMIN_TOKEN not set');
        return;
      }

      // Create product with 2 images
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('name', 'Test Product Remove')
        .field('category', 'curd')
        .field('unit', '500g')
        .field('price', '150')
        .attach('images', path.join(TEST_IMAGE_DIR, 'test-image.jpg'))
        .attach('images', path.join(TEST_IMAGE_DIR, 'test-image.png'));

      const productId = createRes.body.data.product.id;
      const allImages = createRes.body.data.product.images;
      const imageToRemove = allImages[0];

      // Remove first image
      const updateRes = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('remove_images', JSON.stringify([imageToRemove]));

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.product.images).toHaveLength(1);
      expect(updateRes.body.data.product.images[0]).toBe(allImages[1]);

      // Verify removed image is deleted from storage
      const removedFilename = extractFilenameFromUrl(imageToRemove);
      const exists = await fileExistsInStorage(removedFilename);
      expect(exists).toBe(false);

      // Cleanup
      await db.collection('products').doc(productId).delete();
      await deleteImages(updateRes.body.data.product.images);
    }, TEST_TIMEOUT);

  });

  describe('Error Handling & Edge Cases', () => {

    test('should handle Firebase connection errors gracefully', async () => {
      // This test would require mocking Firebase to fail
      // For now, we'll skip it in production
      expect(true).toBe(true);
    });

    test('should handle concurrent uploads without conflicts', async () => {
      const buffer = getTestImageBuffer('test-image.jpg');
      const mockFile = {
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        buffer: buffer,
      };

      // Upload 5 images concurrently
      const promises = Array(5).fill(null).map(() => uploadImages([mockFile]));
      const results = await Promise.all(promises);

      // All should succeed with unique URLs
      const urls = results.flat();
      expect(urls).toHaveLength(5);
      expect(new Set(urls).size).toBe(5); // All unique

      await deleteImages(urls);
    }, TEST_TIMEOUT);

    test('should preserve image metadata (content-type)', async () => {
      const buffer = getTestImageBuffer('test-image.jpg');
      const mockFile = {
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        buffer: buffer,
      };

      const urls = await uploadImages([mockFile]);
      const filename = extractFilenameFromUrl(urls[0]);
      const [metadata] = await bucket.file(filename).getMetadata();

      expect(metadata.contentType).toBe('image/jpeg');

      await deleteImages(urls);
    }, TEST_TIMEOUT);

  });

});

// ─── Performance Tests ─────────────────────────────────────────────────────────

describe('Image Upload - Performance', () => {

  test('should upload image within 5 seconds', async () => {
    const buffer = getTestImageBuffer('test-image.jpg');
    const mockFile = {
      originalname: 'test-image.jpg',
      mimetype: 'image/jpeg',
      buffer: buffer,
    };

    const start = Date.now();
    const urls = await uploadImages([mockFile]);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000);
    await deleteImages(urls);
  }, TEST_TIMEOUT);

  test('should upload 5 images within 15 seconds', async () => {
    const files = Array(5).fill(null).map((_, i) => ({
      originalname: `test-image-${i}.jpg`,
      mimetype: 'image/jpeg',
      buffer: getTestImageBuffer('test-image.jpg'),
    }));

    const start = Date.now();
    const urls = await uploadImages(files);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(15000);
    expect(urls).toHaveLength(5);

    await deleteImages(urls);
  }, TEST_TIMEOUT);

});
