const { admin, db } = require('../config/firebase');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized, forbidden } = require('../utils/response');

/**
 * Middleware: Verify Firebase ID token for user routes.
 * Attaches req.user = { uid, phone, userId, areaId }
 */
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Missing or invalid authorization header');
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const userSnap = await db.collection('users').where('firebase_uid', '==', decoded.uid).limit(1).get();

    if (userSnap.empty) {
      // New user — allow through with minimal info for registration
      req.user = {
        uid: decoded.uid,
        phone: decoded.phone_number || null,
        userId: null,
        areaId: null,
        isNewUser: true,
      };
    } else {
      const userDoc = userSnap.docs[0];
      const userData = userDoc.data();
      req.user = {
        uid: decoded.uid,
        phone: decoded.phone_number || userData.phone,
        userId: userDoc.id,
        areaId: userData.area_id,
        isNewUser: false,
        isProfileComplete: !!(userData.name && userData.area_id && userData.address),
      };
    }

    next();
  } catch (err) {
    console.error('Firebase auth error:', err.message);
    return unauthorized(res, 'Invalid or expired token');
  }
}

/**
 * Middleware: Verify JWT for admin routes.
 * Attaches req.admin = { adminId, areaId, role, username }
 */
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Missing or invalid authorization header');
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.admin = {
      adminId: decoded.adminId,
      areaId: decoded.areaId,
      role: decoded.role,
      username: decoded.username,
    };
    next();
  } catch (err) {
    return unauthorized(res, 'Invalid or expired admin token');
  }
}

/**
 * Middleware: Require super_admin role.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.admin || req.admin.role !== 'super_admin') {
    return forbidden(res, 'Super admin access required');
  }
  next();
}

/**
 * Middleware: Require user to have a complete profile.
 */
function requireCompleteProfile(req, res, next) {
  if (!req.user || !req.user.userId || !req.user.isProfileComplete) {
    return forbidden(res, 'Please complete your profile first');
  }
  next();
}

module.exports = { authenticateUser, authenticateAdmin, requireSuperAdmin, requireCompleteProfile };
