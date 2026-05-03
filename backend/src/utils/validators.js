const config = require('../config');

function isValidMilkType(type) {
  return config.milkTypes.includes(type);
}

async function isValidProductCategory(category) {
  const { db } = require('../config/firebase');
  const snap = await db.collection('categories').where('slug', '==', category).limit(1).get();
  return !snap.empty;
}

function isValidQuantity(qty) {
  return typeof qty === 'number' && qty >= 0.5 && qty <= 10 && qty % 0.5 === 0;
}

function isValidSlot(slot) {
  return ['morning', 'evening', 'both'].includes(slot);
}

function isValidYoutubeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/live\/[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
  ];
  return patterns.some((p) => p.test(url));
}

module.exports = { isValidMilkType, isValidProductCategory, isValidQuantity, isValidSlot, isValidYoutubeUrl };
