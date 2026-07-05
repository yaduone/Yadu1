/**
 * carousel.routes.js — Home & Livestream image carousels (admin-configurable)
 *
 * Three independent carousels, keyed by `location`:
 *   - home_scheduled : hero carousel on the Home (Scheduled) screen
 *   - home_instant   : banner carousel on the Home (Instant) store screen
 *   - livestream     : info carousel on the Livestream screen
 *
 * Each slide is a Firestore doc in the `carousels` collection with its own
 * image, ordering priority and active flag. Admins add / update / delete /
 * reorder slides per location; the app reads active slides for one location.
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

const LOCATIONS = ['home_scheduled', 'home_instant', 'livestream'];
const COLLECTION = 'carousels';

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

function slidePriority(slide) {
  return Number.isInteger(slide.priority) && slide.priority > 0
    ? slide.priority
    : Number.MAX_SAFE_INTEGER;
}

function compareSlides(a, b) {
  return slidePriority(a) - slidePriority(b)
    || (a.created_at?.toMillis?.() || 0) - (b.created_at?.toMillis?.() || 0);
}

async function getSlidesForLocation(location) {
  const snap = await db.collection(COLLECTION).where('location', '==', location).get();
  const slides = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  slides.sort(compareSlides);
  return slides;
}

// ── GET /api/carousels — admin: all slides grouped by location ────────────────
router.get('/', authenticateAdmin, async (req, res, next) => {
  try {
    const grouped = {};
    for (const location of LOCATIONS) {
      grouped[location] = await getSlidesForLocation(location);
    }
    return success(res, { locations: LOCATIONS, carousels: grouped });
  } catch (err) { next(err); }
});

// ── GET /api/carousels/app?location= — app: active slides for one location ────
router.get('/app', authenticateUser, async (req, res, next) => {
  try {
    const location = String(req.query.location || '');
    if (!LOCATIONS.includes(location)) return badRequest(res, 'Invalid carousel location');
    const slides = (await getSlidesForLocation(location))
      .filter((slide) => slide.is_active !== false)
      .map((slide) => ({ id: slide.id, image_url: slide.image_url, title: slide.title || '', link_url: slide.link_url || '' }));
    return success(res, { location, slides });
  } catch (err) { next(err); }
});

// ── POST /api/carousels — admin: add a slide (multipart/form-data) ────────────
// Fields: location (required), image (file, required), title?, link_url?, is_active?
router.post('/', authenticateAdmin, upload.single('image'), handleMulterError, invalidateOn(['carousels', 'public']), async (req, res, next) => {
  try {
    const { location, title = '', link_url = '', is_active } = req.body;
    if (!LOCATIONS.includes(location)) return badRequest(res, 'Invalid carousel location');
    if (!req.file) return badRequest(res, 'An image is required');

    const existing = await getSlidesForLocation(location);
    let imageUrl = '';
    try {
      const imageUrls = await uploadImages([req.file], 'carousels');
      imageUrl = imageUrls[0] || '';
      const slideData = {
        location,
        image_url: imageUrl,
        title: String(title).trim(),
        link_url: String(link_url).trim(),
        is_active: is_active === undefined ? true : is_active === 'true' || is_active === true,
        priority: existing.length + 1,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };
      const docRef = await db.collection(COLLECTION).add(slideData);
      return created(res, { slide: { id: docRef.id, ...slideData } });
    } catch (err) {
      if (imageUrl) await deleteImages([imageUrl]);
      throw err;
    }
  } catch (err) { next(err); }
});

// ── PUT /api/carousels/order — admin: reorder slides within a location ────────
// Body: { location, slide_ids: [...] }
router.put('/order', authenticateAdmin, invalidateOn(['carousels', 'public']), async (req, res, next) => {
  try {
    const { location, slide_ids: slideIds } = req.body;
    if (!LOCATIONS.includes(location)) return badRequest(res, 'Invalid carousel location');
    if (!Array.isArray(slideIds) || slideIds.some((id) => typeof id !== 'string')) {
      return badRequest(res, 'slide_ids must be an array of slide IDs');
    }
    if (new Set(slideIds).size !== slideIds.length) {
      return badRequest(res, 'slide_ids must not contain duplicates');
    }

    const slides = await getSlidesForLocation(location);
    const byId = new Map(slides.map((slide) => [slide.id, slide]));
    if (slideIds.length !== slides.length || slideIds.some((id) => !byId.has(id))) {
      return badRequest(res, 'slide_ids must contain every slide in this location exactly once');
    }

    const batch = db.batch();
    const reordered = slideIds.map((id, index) => {
      const priority = index + 1;
      batch.update(db.collection(COLLECTION).doc(id), {
        priority,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { ...byId.get(id), priority };
    });
    await batch.commit();

    return success(res, { location, slides: reordered }, 'Carousel order updated');
  } catch (err) { next(err); }
});

// ── PUT /api/carousels/:id — admin: update a slide (multipart/form-data) ───────
// Fields: image? (replaces), title?, link_url?, is_active?, remove nothing (image required to exist)
router.put('/:id', authenticateAdmin, upload.single('image'), handleMulterError, invalidateOn(['carousels', 'public']), async (req, res, next) => {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return notFound(res, 'Slide not found');
    const existing = doc.data();

    let imageUrl = existing.image_url || '';
    let imageToDelete = '';
    if (req.file) {
      const imageUrls = await uploadImages([req.file], 'carousels');
      imageUrl = imageUrls[0] || '';
      imageToDelete = existing.image_url || '';
    }

    const updateData = { image_url: imageUrl, updated_at: admin.firestore.FieldValue.serverTimestamp() };
    if (req.body.title !== undefined) updateData.title = String(req.body.title).trim();
    if (req.body.link_url !== undefined) updateData.link_url = String(req.body.link_url).trim();
    if (req.body.is_active !== undefined) updateData.is_active = req.body.is_active === 'true' || req.body.is_active === true;

    try {
      await ref.update(updateData);
    } catch (err) {
      if (req.file && imageUrl) await deleteImages([imageUrl]);
      throw err;
    }
    if (imageToDelete) await deleteImages([imageToDelete]);
    return success(res, { slide: { id: doc.id, location: existing.location, ...updateData } });
  } catch (err) { next(err); }
});

// ── DELETE /api/carousels/:id — admin ─────────────────────────────────────────
router.delete('/:id', authenticateAdmin, invalidateOn(['carousels', 'public']), async (req, res, next) => {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return notFound(res, 'Slide not found');
    await ref.delete();
    if (doc.data().image_url) await deleteImages([doc.data().image_url]);
    return success(res, null, 'Slide deleted');
  } catch (err) { next(err); }
});

module.exports = router;
