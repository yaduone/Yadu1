/**
 * onboarding.routes.js — Registration onboarding / splash pages (admin-configurable)
 *
 * A scrolling, full-screen intro shown to users on new registration. Each page
 * is a Firestore doc in the `onboarding_pages` collection with its own image,
 * headline, description, ordering priority and active flag.
 *
 * Admins add / update / delete / reorder pages; the number of pages, their
 * images and copy are all configurable. The app reads the active pages, in
 * order, and renders them as a swipeable onboarding carousel.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const { db, admin } = require('../../config/firebase');
const { authenticateAdmin, authenticateUser } = require('../../middleware/auth');
const { success, badRequest, notFound, created } = require('../../utils/response');
const { invalidateOn } = require('../../middleware/cache');
const { uploadImages, deleteImages } = require('../../utils/storage');

const COLLECTION = 'onboarding_pages';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(Object.assign(new Error('Only JPG, PNG and WEBP images are allowed'), { statusCode: 400 }));
    }
    cb(null, true);
  },
});

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return badRequest(res, 'File size exceeds 5MB limit');
    return badRequest(res, err.message);
  }
  if (err && err.statusCode === 400) return badRequest(res, err.message);
  next(err);
}

function pagePriority(page) {
  return Number.isInteger(page.priority) && page.priority > 0
    ? page.priority
    : Number.MAX_SAFE_INTEGER;
}

function comparePages(a, b) {
  return pagePriority(a) - pagePriority(b)
    || (a.created_at?.toMillis?.() || 0) - (b.created_at?.toMillis?.() || 0);
}

async function getAllPages() {
  const snap = await db.collection(COLLECTION).get();
  const pages = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  pages.sort(comparePages);
  return pages;
}

// ── GET /api/onboarding — admin: all pages in order ───────────────────────────
router.get('/', authenticateAdmin, async (req, res, next) => {
  try {
    return success(res, { pages: await getAllPages() });
  } catch (err) { next(err); }
});

// ── GET /api/onboarding/app — app: active pages for the onboarding carousel ───
router.get('/app', authenticateUser, async (req, res, next) => {
  try {
    const pages = (await getAllPages())
      .filter((page) => page.is_active !== false)
      .map((page) => ({
        id: page.id,
        image_url: page.image_url,
        headline: page.headline || '',
        description: page.description || '',
      }));
    return success(res, { pages });
  } catch (err) { next(err); }
});

// ── POST /api/onboarding — admin: add a page (multipart/form-data) ────────────
// Fields: image (file, required), headline?, description?, is_active?
router.post('/', authenticateAdmin, upload.single('image'), handleMulterError, invalidateOn(['onboarding', 'public']), async (req, res, next) => {
  try {
    const { headline = '', description = '', is_active } = req.body;
    if (!req.file) return badRequest(res, 'An image is required');

    const existing = await getAllPages();
    let imageUrl = '';
    try {
      const imageUrls = await uploadImages([req.file], 'onboarding');
      imageUrl = imageUrls[0] || '';
      const pageData = {
        image_url: imageUrl,
        headline: String(headline).trim(),
        description: String(description).trim(),
        is_active: is_active === undefined ? true : is_active === 'true' || is_active === true,
        priority: existing.length + 1,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };
      const docRef = await db.collection(COLLECTION).add(pageData);
      return created(res, { page: { id: docRef.id, ...pageData } });
    } catch (err) {
      if (imageUrl) await deleteImages([imageUrl]);
      throw err;
    }
  } catch (err) { next(err); }
});

// ── PUT /api/onboarding/order — admin: reorder pages ──────────────────────────
// Body: { page_ids: [...] }
router.put('/order', authenticateAdmin, invalidateOn(['onboarding', 'public']), async (req, res, next) => {
  try {
    const { page_ids: pageIds } = req.body;
    if (!Array.isArray(pageIds) || pageIds.some((id) => typeof id !== 'string')) {
      return badRequest(res, 'page_ids must be an array of page IDs');
    }
    if (new Set(pageIds).size !== pageIds.length) {
      return badRequest(res, 'page_ids must not contain duplicates');
    }

    const pages = await getAllPages();
    const byId = new Map(pages.map((page) => [page.id, page]));
    if (pageIds.length !== pages.length || pageIds.some((id) => !byId.has(id))) {
      return badRequest(res, 'page_ids must contain every page exactly once');
    }

    const batch = db.batch();
    const reordered = pageIds.map((id, index) => {
      const priority = index + 1;
      batch.update(db.collection(COLLECTION).doc(id), {
        priority,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { ...byId.get(id), priority };
    });
    await batch.commit();

    return success(res, { pages: reordered }, 'Onboarding order updated');
  } catch (err) { next(err); }
});

// ── PUT /api/onboarding/:id — admin: update a page (multipart/form-data) ──────
// Fields: image? (replaces), headline?, description?, is_active?
router.put('/:id', authenticateAdmin, upload.single('image'), handleMulterError, invalidateOn(['onboarding', 'public']), async (req, res, next) => {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return notFound(res, 'Onboarding page not found');
    const existing = doc.data();

    let imageUrl = existing.image_url || '';
    let imageToDelete = '';
    if (req.file) {
      const imageUrls = await uploadImages([req.file], 'onboarding');
      imageUrl = imageUrls[0] || '';
      imageToDelete = existing.image_url || '';
    }

    const updateData = { image_url: imageUrl, updated_at: admin.firestore.FieldValue.serverTimestamp() };
    if (req.body.headline !== undefined) updateData.headline = String(req.body.headline).trim();
    if (req.body.description !== undefined) updateData.description = String(req.body.description).trim();
    if (req.body.is_active !== undefined) updateData.is_active = req.body.is_active === 'true' || req.body.is_active === true;

    try {
      await ref.update(updateData);
    } catch (err) {
      if (req.file && imageUrl) await deleteImages([imageUrl]);
      throw err;
    }
    if (imageToDelete) await deleteImages([imageToDelete]);
    return success(res, { page: { id: doc.id, ...updateData } });
  } catch (err) { next(err); }
});

// ── DELETE /api/onboarding/:id — admin ────────────────────────────────────────
router.delete('/:id', authenticateAdmin, invalidateOn(['onboarding', 'public']), async (req, res, next) => {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return notFound(res, 'Onboarding page not found');
    await ref.delete();
    if (doc.data().image_url) await deleteImages([doc.data().image_url]);
    return success(res, null, 'Onboarding page deleted');
  } catch (err) { next(err); }
});

module.exports = router;
