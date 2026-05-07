/**
 * Migration: Rename Rajendranagar → Bareilly
 *
 * Safe to run against live Firestore — updates in-place, no deletes.
 * Run: node migrations/rename_area_rajendranagar_to_bareilly.js
 */
require('dotenv').config();
const { db, admin } = require('../src/config/firebase');
const bcrypt = require('bcryptjs');

async function migrate() {
  console.log('Starting migration: Rajendranagar → Bareilly\n');

  // ── 1. Update area document ──────────────────────────────────────────────
  console.log('Updating area...');
  const areaSnap = await db.collection('areas').where('slug', '==', 'rajendranagar').limit(1).get();

  if (areaSnap.empty) {
    console.log('  Area "rajendranagar" not found — checking if "bareilly" already exists...');
    const already = await db.collection('areas').where('slug', '==', 'bareilly').limit(1).get();
    if (!already.empty) {
      console.log('  Area "bareilly" already exists. Skipping area update.');
    } else {
      console.error('  ERROR: Neither "rajendranagar" nor "bareilly" area found. Aborting.');
      process.exit(1);
    }
  } else {
    const areaDoc = areaSnap.docs[0];
    await areaDoc.ref.update({
      name: 'Bareilly',
      slug: 'bareilly',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  Updated area ${areaDoc.id}: Rajendranagar → Bareilly`);
  }

  // ── 2. Update admin document ─────────────────────────────────────────────
  console.log('\nUpdating admin...');
  const adminSnap = await db.collection('admins').where('username', '==', 'rajendra_admin').limit(1).get();

  if (adminSnap.empty) {
    console.log('  Admin "rajendra_admin" not found — checking if "bareilly_admin" already exists...');
    const already = await db.collection('admins').where('username', '==', 'bareilly_admin').limit(1).get();
    if (!already.empty) {
      console.log('  Admin "bareilly_admin" already exists. Skipping admin update.');
    } else {
      console.error('  ERROR: Neither "rajendra_admin" nor "bareilly_admin" found. Aborting.');
      process.exit(1);
    }
  } else {
    const adminDoc = adminSnap.docs[0];
    const passwordHash = await bcrypt.hash('Bar@1234', 10);
    await adminDoc.ref.update({
      username: 'bareilly_admin',
      name: 'Bareilly Admin',
      password_hash: passwordHash,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  Updated admin ${adminDoc.id}: rajendra_admin → bareilly_admin`);
  }

  // ── 3. Update any users whose area_id points to this area ────────────────
  console.log('\nChecking for users assigned to this area...');
  const areaRef = await db.collection('areas').where('slug', '==', 'bareilly').limit(1).get();
  if (!areaRef.empty) {
    const areaId = areaRef.docs[0].id;
    const usersSnap = await db.collection('users').where('area_id', '==', areaId).get();
    console.log(`  ${usersSnap.size} user(s) found — area_id reference is unchanged (document ID is stable).`);
  }

  console.log('\nMigration completed successfully.');
  console.log('New admin credentials: bareilly_admin / Bar@1234');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
