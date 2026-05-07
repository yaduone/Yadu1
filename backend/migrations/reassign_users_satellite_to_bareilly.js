/**
 * Migration: Reassign users from Satellite → Bareilly
 *
 * Users who signed up before the slug migration had their area_id set to
 * Satellite (fallback). This script moves them to Bareilly.
 *
 * Run: node migrations/reassign_users_satellite_to_bareilly.js
 */
require('dotenv').config();
const { db, admin } = require('../src/config/firebase');

async function migrate() {
  console.log('Starting migration: reassign users Satellite → Bareilly\n');

  // 1. Resolve area document IDs
  const [satelliteSnap, bareillySnap] = await Promise.all([
    db.collection('areas').where('slug', '==', 'satellite').limit(1).get(),
    db.collection('areas').where('slug', '==', 'bareilly').limit(1).get(),
  ]);

  if (satelliteSnap.empty) {
    console.error('ERROR: Satellite area not found. Aborting.');
    process.exit(1);
  }
  if (bareillySnap.empty) {
    console.error('ERROR: Bareilly area not found. Run the rename migration first. Aborting.');
    process.exit(1);
  }

  const satelliteId = satelliteSnap.docs[0].id;
  const bareillyId  = bareillySnap.docs[0].id;

  console.log(`Satellite area ID : ${satelliteId}`);
  console.log(`Bareilly  area ID : ${bareillyId}\n`);

  if (satelliteId === bareillyId) {
    console.error('ERROR: Both areas resolved to the same document. Aborting.');
    process.exit(1);
  }

  // 2. Find all users currently assigned to Satellite
  const usersSnap = await db.collection('users')
    .where('area_id', '==', satelliteId)
    .get();

  if (usersSnap.empty) {
    console.log('No users found under Satellite. Nothing to migrate.');
    process.exit(0);
  }

  console.log(`Found ${usersSnap.size} user(s) under Satellite. Reassigning to Bareilly...\n`);

  // 3. Update in batches (Firestore batch limit = 500)
  let batch = db.batch();
  let count = 0;

  for (const doc of usersSnap.docs) {
    const u = doc.data();
    batch.update(doc.ref, {
      area_id: bareillyId,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
    console.log(`  [${count}] ${u.name || '(incomplete)'} — ${u.phone || doc.id}`);

    if (count % 500 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (count % 500 !== 0) await batch.commit();

  console.log(`\nDone. ${count} user(s) moved from Satellite → Bareilly.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
