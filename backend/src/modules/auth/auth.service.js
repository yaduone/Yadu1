const { admin, db } = require('../../config/firebase');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../../config');
const { logActivity } = require('../../utils/activityLog');

/**
 * Verify Firebase token and find/create user.
 */
async function verifyUserToken(firebaseToken) {
  const decoded = await admin.auth().verifyIdToken(firebaseToken);
  const { uid, phone_number } = decoded;

  const userSnap = await db.collection('users').where('firebase_uid', '==', uid).limit(1).get();

  if (userSnap.empty) {
    // Create a new user stub
    const newUser = {
      firebase_uid: uid,
      phone: phone_number || null,
      name: null,
      area_id: null,
      address: null,
      is_active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    const docRef = await db.collection('users').add(newUser);

    // Log new user sign-up
    await logActivity({
      type: 'new_user',
      title: 'New User Signed Up',
      message: `A new user signed up with phone ${phone_number || 'unknown'}.`,
      meta: { user_id: docRef.id, phone: phone_number || null },
    });

    return {
      user: { id: docRef.id, ...newUser, is_profile_complete: false },
      is_new_user: true,
    };
  }

  const userDoc = userSnap.docs[0];
  const userData = userDoc.data();
  const isProfileComplete = !!(userData.name && userData.area_id && userData.address);

  return {
    user: { id: userDoc.id, ...userData, is_profile_complete: isProfileComplete },
    is_new_user: false,
  };
}

/**
 * Complete user profile after first login.
 */
async function completeProfile(userId, { name, area_id, address }) {
  // Verify area exists
  const areaDoc = await db.collection('areas').doc(area_id).get();
  if (!areaDoc.exists || !areaDoc.data().is_active) {
    throw Object.assign(new Error('Invalid or inactive area'), { statusCode: 400 });
  }

  const updateData = {
    name,
    area_id,
    address,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('users').doc(userId).update(updateData);

  const updatedDoc = await db.collection('users').doc(userId).get();
  const updatedData = updatedDoc.data();

  // Log profile completion
  await logActivity({
    type: 'profile_completed',
    title: 'User Profile Completed',
    message: `${name} completed their profile and is now active in area ${area_id}.`,
    areaId: area_id,
    meta: { user_id: userId, name, area_id, phone: updatedData.phone || null },
  });

  return { id: updatedDoc.id, ...updatedData, is_profile_complete: true };
}

/**
 * Admin login with username/password.
 */
async function adminLogin(username, password) {
  const adminSnap = await db.collection('admins').where('username', '==', username).limit(1).get();

  if (adminSnap.empty) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const adminDoc = adminSnap.docs[0];
  const adminData = adminDoc.data();

  if (!adminData.is_active) {
    throw Object.assign(new Error('Account is deactivated'), { statusCode: 401 });
  }

  const isMatch = await bcrypt.compare(password, adminData.password_hash);
  if (!isMatch) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const token = jwt.sign(
    {
      adminId: adminDoc.id,
      areaId: adminData.area_id,
      role: adminData.role,
      username: adminData.username,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return {
    admin: {
      id: adminDoc.id,
      username: adminData.username,
      name: adminData.name,
      area_id: adminData.area_id,
      role: adminData.role,
    },
    token,
  };
}

module.exports = { verifyUserToken, completeProfile, adminLogin };
