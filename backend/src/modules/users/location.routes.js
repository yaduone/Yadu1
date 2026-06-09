const express = require('express');
const router = express.Router();
const { db } = require('../../config/firebase');
const { authenticateAdmin } = require('../../middleware/auth');
const { success, error } = require('../../utils/response');

/**
 * POST /api/users/:userId/location
 * Admin: Record/update a user's physical location
 */
router.post('/:userId/location', authenticateAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return error(res, 'Latitude and longitude are required', 400);
    }

    // Validate coordinates
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return error(res, 'Invalid coordinates', 400);
    }

    // Check if user exists
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return error(res, 'User not found', 404);
    }

    // Update user's location
    const locationData = {
      latitude: lat,
      longitude: lon,
      recorded_by: req.admin.id,
      recorded_at: new Date(),
    };

    await db.collection('users').doc(userId).update({
      location: locationData,
      updated_at: new Date(),
    });

    return success(res, { 
      message: 'Location recorded successfully',
      location: locationData,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:userId/location
 * Admin: Get a user's recorded location
 */
router.get('/:userId/location', authenticateAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return error(res, 'User not found', 404);
    }

    const userData = userDoc.data();
    const location = userData.location || null;

    return success(res, { location });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/users/:userId/location
 * Admin: Remove a user's recorded location
 */
router.delete('/:userId/location', authenticateAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return error(res, 'User not found', 404);
    }

    await db.collection('users').doc(userId).update({
      location: null,
      updated_at: new Date(),
    });

    return success(res, { message: 'Location removed successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
