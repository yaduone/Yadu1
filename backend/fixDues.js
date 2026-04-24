const admin = require('firebase-admin');

// Ensure correct path to your service account if needed.
// Relying on config to initialize admin.
try {
  const serviceAccount = require('./service-account-key.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.log('Admin already initialized or error loading credentials:', e.message);
}

const db = admin.firestore();

async function run() {
  console.log('Starting recalculation of due_amounts...');
  const duesSnap = await db.collection('due_amounts').get();
  
  let fixedCount = 0;
  
  for (const docSnap of duesSnap.docs) {
    const data = docSnap.data();
    
    const billed = data.total_billed || 0;
    const paid = data.total_paid || 0;
    
    // The exact invariant we want to maintain
    const expectedDue = billed - paid;
    const currentDue = data.due_amount || 0;
    
    // Even if it's off by slight float precision, we strictly reset it to mathematical expected.
    if (Math.abs(currentDue - expectedDue) > 0.001) {
      console.log(`Fixing User ${data.user_id || docSnap.id}: Billed=${billed}, Paid=${paid}, Old Due=${currentDue}, New Due=${expectedDue}`);
      await docSnap.ref.update({
        due_amount: expectedDue,
        last_updated: admin.firestore.FieldValue.serverTimestamp()
      });
      fixedCount++;
    }
  }
  
  console.log(`\nFinished! Fixed ${fixedCount} records.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
