const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');
const { authenticateAdmin } = require('../../middleware/auth');
const { success, created, badRequest, notFound } = require('../../utils/response');

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function serializeTimestamp(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serializeNote(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || '',
    body: data.body || '',
    area_id: data.area_id,
    created_by_admin_id: data.created_by_admin_id || null,
    updated_by_admin_id: data.updated_by_admin_id || null,
    created_at: serializeTimestamp(data.created_at),
    updated_at: serializeTimestamp(data.updated_at),
  };
}

function validateNotePayload(body) {
  const title = cleanString(body.title);
  const noteBody = cleanString(body.body);

  if (!title) return { error: 'title is required' };
  if (!noteBody) return { error: 'body is required' };
  if (title.length > 120) return { error: 'title must be 120 characters or fewer' };
  if (noteBody.length > 5000) return { error: 'body must be 5000 characters or fewer' };

  return { note: { title, body: noteBody } };
}

// GET /api/notes - Admin: list notes for the admin's area
router.get('/', authenticateAdmin, async (req, res, next) => {
  try {
    const snap = await db.collection('admin_notes')
      .where('area_id', '==', req.admin.areaId)
      .get();

    const notes = snap.docs
      .map(serializeNote)
      .sort((a, b) => {
        const aTime = a.updated_at || a.created_at || '';
        const bTime = b.updated_at || b.created_at || '';
        return bTime.localeCompare(aTime);
      });

    return success(res, { notes, total: notes.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/notes - Admin: create a note for the admin's area
router.post('/', authenticateAdmin, async (req, res, next) => {
  try {
    const validation = validateNotePayload(req.body);
    if (validation.error) return badRequest(res, validation.error);

    const now = admin.firestore.FieldValue.serverTimestamp();
    const noteData = {
      ...validation.note,
      area_id: req.admin.areaId,
      created_by_admin_id: req.admin.adminId,
      updated_by_admin_id: req.admin.adminId,
      created_at: now,
      updated_at: now,
    };

    const docRef = await db.collection('admin_notes').add(noteData);
    const newDoc = await docRef.get();
    return created(res, { note: serializeNote(newDoc) }, 'Note created');
  } catch (err) {
    next(err);
  }
});

// PUT /api/notes/:id - Admin: update an area note
router.put('/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const validation = validateNotePayload(req.body);
    if (validation.error) return badRequest(res, validation.error);

    const noteRef = db.collection('admin_notes').doc(req.params.id);
    const noteDoc = await noteRef.get();
    if (!noteDoc.exists || noteDoc.data().area_id !== req.admin.areaId) {
      return notFound(res, 'Note not found');
    }

    const updateData = {
      ...validation.note,
      updated_by_admin_id: req.admin.adminId,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    await noteRef.update(updateData);
    const updatedDoc = await noteRef.get();

    return success(res, { note: serializeNote(updatedDoc) }, 'Note updated');
  } catch (err) {
    next(err);
  }
});

// DELETE /api/notes/:id - Admin: delete an area note
router.delete('/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const noteRef = db.collection('admin_notes').doc(req.params.id);
    const noteDoc = await noteRef.get();
    if (!noteDoc.exists || noteDoc.data().area_id !== req.admin.areaId) {
      return notFound(res, 'Note not found');
    }

    await noteRef.delete();
    return success(res, null, 'Note deleted');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
