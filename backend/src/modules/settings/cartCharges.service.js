const { db, admin } = require('../../config/firebase');

// Configurable cart-confirmation charges (platform fee, delivery charge, QA fees, …).
// Stored as a single settings document holding a separate list for each
// delivery type so scheduled and instant deliveries can be priced differently.
const COLLECTION = 'settings';
const DOC_ID = 'cart_charges';
const TYPES = ['scheduled', 'instant'];

function emptyConfig() {
  return { scheduled: [], instant: [] };
}

function normalizeType(type) {
  if (!TYPES.includes(type)) {
    throw Object.assign(new Error(`type must be one of: ${TYPES.join(', ')}`), { statusCode: 400 });
  }
  return type;
}

function makeId() {
  return `chg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Validate + normalize a single charge coming from the admin panel.
function normalizeCharge(raw, index) {
  if (!raw || typeof raw !== 'object') {
    throw Object.assign(new Error(`charge #${index + 1} is invalid`), { statusCode: 400 });
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) {
    throw Object.assign(new Error(`charge #${index + 1} must have a name`), { statusCode: 400 });
  }

  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw Object.assign(new Error(`"${name}" must have an amount of 0 or more`), { statusCode: 400 });
  }

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId(),
    name,
    amount: Math.round(amount * 100) / 100,
  };
}

function normalizeChargeList(list) {
  if (list == null) return [];
  if (!Array.isArray(list)) {
    throw Object.assign(new Error('charges must be a list'), { statusCode: 400 });
  }
  return list.map(normalizeCharge);
}

async function getAllCharges() {
  const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!doc.exists) return emptyConfig();
  const data = doc.data() || {};
  return {
    scheduled: Array.isArray(data.scheduled) ? data.scheduled : [],
    instant: Array.isArray(data.instant) ? data.instant : [],
  };
}

async function getChargesForType(type) {
  const all = await getAllCharges();
  return all[normalizeType(type)];
}

// Replace the whole charge list for one delivery type.
async function updateChargesForType(type, charges, adminId) {
  const key = normalizeType(type);
  const normalized = normalizeChargeList(charges);

  await db.collection(COLLECTION).doc(DOC_ID).set(
    {
      [key]: normalized,
      updated_by: adminId || null,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return normalized;
}

module.exports = {
  TYPES,
  emptyConfig,
  normalizeType,
  normalizeChargeList,
  getAllCharges,
  getChargesForType,
  updateChargesForType,
};
