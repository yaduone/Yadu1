/**
 * Seed script: populates Firestore with initial data.
 *
 * Run: npm run seed
 *
 * PREREQUISITE: service-account-key.json must be in backend/ directory.
 */
require('dotenv').config();
const { db, admin } = require('../src/config/firebase');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('Starting seed...\n');

  // 1. Seed Areas
  console.log('Seeding areas...');
  const areas = [
    { name: 'Rajendranagar', slug: 'rajendranagar', is_active: true },
    { name: 'Satellite', slug: 'satellite', is_active: true },
  ];

  const areaIds = {};
  for (const area of areas) {
    // Check if area already exists
    const existing = await db.collection('areas').where('slug', '==', area.slug).limit(1).get();
    if (!existing.empty) {
      areaIds[area.slug] = existing.docs[0].id;
      console.log(`  Area "${area.name}" already exists (${existing.docs[0].id})`);
    } else {
      const ref = await db.collection('areas').add({
        ...area,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      areaIds[area.slug] = ref.id;
      console.log(`  Created area "${area.name}" (${ref.id})`);
    }
  }

  // 2. Seed Admins
  console.log('\nSeeding admins...');
  const admins = [
    {
      username: 'rajendra_admin',
      password: 'Raj@1234',
      name: 'Rajendranagar Admin',
      area_slug: 'rajendranagar',
      role: 'area_admin',
    },
    {
      username: 'satellite_admin',
      password: 'Sat@1234',
      name: 'Satellite Admin',
      area_slug: 'satellite',
      role: 'area_admin',
    },
  ];

  for (const adm of admins) {
    const existing = await db.collection('admins').where('username', '==', adm.username).limit(1).get();
    if (!existing.empty) {
      console.log(`  Admin "${adm.username}" already exists`);
      continue;
    }

    const passwordHash = await bcrypt.hash(adm.password, 10);
    await db.collection('admins').add({
      username: adm.username,
      password_hash: passwordHash,
      name: adm.name,
      area_id: areaIds[adm.area_slug],
      role: adm.role,
      is_active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  Created admin "${adm.username}" for area ${adm.area_slug}`);
  }

  // 3. Seed Price Config
  console.log('\nSeeding price config...');
  const prices = [
    { milk_type: 'cow', price_per_litre: 60, is_active: true },
    { milk_type: 'buffalo', price_per_litre: 70, is_active: true },
    { milk_type: 'toned', price_per_litre: 50, is_active: true },
  ];

  for (const price of prices) {
    const existing = await db.collection('price_config').where('milk_type', '==', price.milk_type).limit(1).get();
    if (!existing.empty) {
      console.log(`  Price for "${price.milk_type}" already exists`);
      continue;
    }

    await db.collection('price_config').add({
      ...price,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  Created price: ${price.milk_type} @ Rs.${price.price_per_litre}/litre`);
  }

  // 4. Seed Products
  console.log('\nSeeding products...');
  const products = [
    { name: 'Fresh Curd 500g', category: 'curd', unit: '500g', price: 40, description: 'Fresh homemade curd' },
    { name: 'Paneer 200g', category: 'paneer', unit: '200g', price: 80, description: 'Fresh cottage cheese' },
    { name: 'Butter Milk 500ml', category: 'butter_milk', unit: '500ml', price: 25, description: 'Traditional chaas' },
    { name: 'Pure Ghee 500ml', category: 'ghee', unit: '500ml', price: 350, description: 'Pure desi ghee' },
    { name: 'Fresh Butter 100g', category: 'butter', unit: '100g', price: 55, description: 'Homemade white butter' },
    { name: 'Sweet Lassi 250ml', category: 'lassi', unit: '250ml', price: 30, description: 'Sweet yogurt drink' },
    { name: 'Fresh Cream 200ml', category: 'cream', unit: '200ml', price: 45, description: 'Fresh dairy cream' },
    { name: 'Cheese Slice 100g', category: 'cheese', unit: '100g', price: 60, description: 'Processed cheese slices' },
  ];

  for (const product of products) {
    const existing = await db.collection('products').where('name', '==', product.name).limit(1).get();
    if (!existing.empty) {
      console.log(`  Product "${product.name}" already exists`);
      continue;
    }

    await db.collection('products').add({
      ...product,
      is_active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  Created product: ${product.name} (${product.category}) @ Rs.${product.price}`);
  }

  console.log('\nSeed completed successfully!');
  console.log('\nDemo admin credentials:');
  console.log('  Rajendranagar: rajendra_admin / Raj@1234');
  console.log('  Satellite: satellite_admin / Sat@1234');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
