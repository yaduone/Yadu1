const { db, admin, bucket } = require('../../config/firebase');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const os = require('os');
const manifestSettings = require('../settings/manifestSettings.service');
const { logActivity } = require('../../utils/activityLog');

function serializeManifest(doc) {
  const d = doc.data ? doc.data() : doc;
  const id = doc.id || d.id;
  return {
    id,
    ...d,
    is_final: d.status === 'preview' ? false : d.is_final !== false,
    generated_at: d.generated_at?.toDate ? d.generated_at.toDate().toISOString() : d.generated_at || null,
    pdf_filename: d.pdf_storage_path ? path.basename(d.pdf_storage_path) : null,
  };
}

function aggregateExtraItems(orders) {
  const itemMap = new Map();

  orders.forEach((order) => {
    (order.extraItems || []).forEach((item) => {
      const name = item.product_name || item.name || 'Extra item';
      const unit = item.unit || '';
      const quantity = Number(item.quantity) || 0;
      const key = `${name}::${unit}`;

      if (!itemMap.has(key)) {
        itemMap.set(key, {
          product_name: name,
          unit,
          quantity: 0,
        });
      }

      itemMap.get(key).quantity += quantity;
    });
  });

  return Array.from(itemMap.values()).sort((a, b) =>
    a.product_name.localeCompare(b.product_name)
  );
}

function formatExtraItemSummaryLine(item) {
  const unitText = item.unit ? ` (${item.unit})` : '';
  return `${item.product_name}${unitText}: ${item.quantity}`;
}

async function enrichRowsWithUsers(rows) {
  return Promise.all(rows.map(async (row) => {
    const userDoc = await db.collection('users').doc(row.userId).get();
    const userData = userDoc.exists ? userDoc.data() : { name: 'Unknown', phone: 'N/A', address: {} };

    return {
      orderId: row.orderId || null,
      userName: userData.name || 'Unknown',
      phone: userData.phone || 'N/A',
      address: userData.address
        ? `${userData.address.line1 || ''}${userData.address.line2 ? ', ' + userData.address.line2 : ''}${userData.address.landmark ? ', ' + userData.address.landmark : ''}`
        : 'N/A',
      deliverySlot: row.deliverySlot || 'morning',
      milk: row.milk || null,
      extraItems: row.extraItems || [],
      totalAmount: Number(row.totalAmount) || 0,
    };
  }));
}

async function buildGeneratedOrderRows(areaId, date) {
  const ordersSnap = await db
    .collection('orders')
    .where('area_id', '==', areaId)
    .where('date', '==', date)
    .get();

  const routedOrders = ordersSnap.docs.filter((orderDoc) => {
    const order = orderDoc.data();
    return !(
      order.status === 'not_delivered' &&
      order.non_delivery_reason === 'skipped' &&
      !order.milk &&
      (order.extra_items || []).length === 0
    );
  });

  return enrichRowsWithUsers(routedOrders.map((orderDoc) => {
    const order = orderDoc.data();
    return {
      orderId: orderDoc.id,
      userId: order.user_id,
      deliverySlot: order.delivery_slot,
      milk: order.milk,
      extraItems: order.extra_items || [],
      totalAmount: order.total_amount,
    };
  }));
}

function milkFromLiveSubscription(subscription, override) {
  if (override?.override_type === 'skip') return null;
  const quantity = override?.override_type === 'modify'
    ? override.modified_quantity
    : subscription.quantity_litres;
  return {
    milk_type: subscription.milk_type,
    quantity_litres: quantity,
    price_per_litre: subscription.price_per_litre,
    total: quantity * subscription.price_per_litre,
  };
}

async function buildLivePreviewRows(areaId, date) {
  const [subscriptionsSnap, cartsSnap, overridesSnap] = await Promise.all([
    db.collection('subscriptions').where('area_id', '==', areaId).where('status', '==', 'active').get(),
    db.collection('carts').where('area_id', '==', areaId).where('date', '==', date).get(),
    db.collection('next_day_overrides').where('area_id', '==', areaId).where('date', '==', date).get(),
  ]);

  const cartsByUser = new Map();
  cartsSnap.docs.forEach((doc) => {
    const cart = doc.data();
    cartsByUser.set(cart.user_id, cart.items || []);
  });
  const overridesByUser = new Map();
  overridesSnap.docs.forEach((doc) => {
    const override = doc.data();
    overridesByUser.set(override.user_id, override);
  });

  const coveredUsers = new Set();
  const rows = [];
  subscriptionsSnap.docs.forEach((doc) => {
    const subscription = doc.data();
    if (subscription.start_date > date) return;

    const userId = subscription.user_id;
    const override = overridesByUser.get(userId);
    const milk = milkFromLiveSubscription(subscription, override);
    const extraItems = cartsByUser.get(userId) || [];
    if (!milk && extraItems.length === 0) return;

    coveredUsers.add(userId);
    rows.push({
      userId,
      deliverySlot: subscription.delivery_slot || 'morning',
      milk,
      extraItems,
      totalAmount: (milk?.total || 0) + extraItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0),
    });
  });

  cartsByUser.forEach((extraItems, userId) => {
    if (coveredUsers.has(userId) || extraItems.length === 0) return;
    rows.push({
      userId,
      deliverySlot: 'morning',
      milk: null,
      extraItems,
      totalAmount: extraItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0),
    });
  });

  return enrichRowsWithUsers(rows);
}

/**
 * Generate a delivery manifest for a specific area and date.
 * Final manifests are generated from finalized order records.
 */
async function generateManifest(areaId, date, generatedBy = 'system') {
  const orders = await buildGeneratedOrderRows(areaId, date);
  return saveManifest(areaId, date, generatedBy, orders, { status: 'ready', source: 'orders' });
}

/**
 * Generate a non-final next-day preview from the live cart and subscription state.
 * This intentionally does not create orders or consume carts/overrides.
 */
async function generateLivePreview(areaId, date, generatedBy) {
  const existingSnap = await db
    .collection('manifests')
    .where('area_id', '==', areaId)
    .where('date', '==', date)
    .limit(1)
    .get();
  if (!existingSnap.empty && serializeManifest(existingSnap.docs[0]).is_final) {
    return serializeManifest(existingSnap.docs[0]);
  }

  const orders = await buildLivePreviewRows(areaId, date);
  return saveManifest(areaId, date, generatedBy, orders, { status: 'preview', source: 'live_cart' });
}

async function saveManifest(areaId, date, generatedBy, orders, { status, source }) {
  // 1. Get area info
  const areaDoc = await manifestSettings.findAreaDocByIdOrSlug(areaId);
  if (!areaDoc) throw new Error(`Area ${areaId} not found`);
  const area = areaDoc.data();

  // 2. Split orders into slot groups.
  //    'both' subscribers appear in BOTH morning and evening sections.
  const morningOrders = orders.filter((o) => o.deliverySlot === 'morning' || o.deliverySlot === 'both');
  const eveningOrders = orders.filter((o) => o.deliverySlot === 'evening' || o.deliverySlot === 'both');

  // 3. Calculate totals
  const totalUsers = orders.length;
  const totalMilkLitres = orders.reduce((sum, o) => {
    if (!o.milk) return sum;
    // 'both' slot delivers quantity_litres per slot, so count twice
    return sum + o.milk.quantity_litres * (o.deliverySlot === 'both' ? 2 : 1);
  }, 0);
  const extraItemsSummary = aggregateExtraItems(orders);
  const totalExtraItems = extraItemsSummary.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  const morningUsers = morningOrders.length;
  const morningMilkLitres = morningOrders.reduce((sum, o) => sum + (o.milk ? o.milk.quantity_litres : 0), 0);
  const eveningUsers = eveningOrders.length;
  const eveningMilkLitres = eveningOrders.reduce((sum, o) => sum + (o.milk ? o.milk.quantity_litres : 0), 0);

  // 4. Generate PDF to a temp file, then upload to Firebase Storage
  const areaFileSlug = String(area.slug || areaDoc.id || areaId || 'area').replace(/[^a-z0-9_-]/gi, '_');
  const previewSuffix = status === 'preview' ? '_preview' : '';
  const fileName = `${areaFileSlug}_${date}${previewSuffix}.pdf`;
  const filePath = path.join(os.tmpdir(), fileName);

  await generatePDF(filePath, {
    area: area.name,
    date,
    morningOrders,
    eveningOrders,
    totalUsers,
    totalMilkLitres,
    totalExtraItems,
    extraItemsSummary,
    totalAmount,
    morningUsers,
    morningMilkLitres,
    eveningUsers,
    eveningMilkLitres,
    isPreview: status === 'preview',
  });

  // 5. Upload PDF to Firebase Storage, then clean up temp file
  const storagePath = status === 'preview' ? `manifests/previews/${fileName}` : `manifests/${fileName}`;
  await bucket.upload(filePath, {
    destination: storagePath,
    metadata: { contentType: 'application/pdf' },
  });
  fs.unlink(filePath, () => {}); // clean up temp file (fire-and-forget)

  // 6. Save/update manifest record
  const existingSnap = await db
    .collection('manifests')
    .where('area_id', '==', areaId)
    .where('date', '==', date)
    .limit(1)
    .get();

  const manifestData = {
    area_id: areaId,
    date,
    total_users: totalUsers,
    total_milk_litres: totalMilkLitres,
    total_extra_items: totalExtraItems,
    extra_items_summary: extraItemsSummary,
    total_amount: totalAmount,
    morning_users: morningUsers,
    morning_milk_litres: morningMilkLitres,
    evening_users: eveningUsers,
    evening_milk_litres: eveningMilkLitres,
    pdf_storage_path: storagePath, // Storage path instead of local disk path
    status,
    source,
    is_final: status === 'ready',
    generated_at: admin.firestore.FieldValue.serverTimestamp(),
    generated_by: generatedBy,
    finalized_at: status === 'ready' ? admin.firestore.FieldValue.serverTimestamp() : null,
  };

  let manifestId;
  if (existingSnap.empty) {
    const generatedId = ['delivery', areaId, date].map((part) => encodeURIComponent(part)).join('_');
    const docRef = db.collection('manifests').doc(generatedId);
    await docRef.set(manifestData);
    manifestId = docRef.id;
  } else {
    manifestId = existingSnap.docs[0].id;
    const replacedStoragePath = existingSnap.docs[0].data().pdf_storage_path;
    await existingSnap.docs[0].ref.update(manifestData);
    if (status === 'ready' && replacedStoragePath && replacedStoragePath !== storagePath) {
      bucket.file(replacedStoragePath).delete({ ignoreNotFound: true }).catch((err) => {
        console.warn('[manifest] Unable to remove superseded preview PDF:', err.message);
      });
    }
  }

  const result = {
    id: manifestId,
    ...manifestData,
    generated_at: new Date().toISOString(),
    pdf_path: undefined,
    pdf_filename: fileName,
    status,
  };

  // Log manifest generation or preview generation.
  await logActivity({
    type: status === 'preview' ? 'manifest_preview_generated' : 'manifest_generated',
    title: status === 'preview' ? 'Manifest Preview Generated' : 'Manifest Generated',
    message: `${status === 'preview' ? 'Delivery manifest preview' : 'Delivery manifest'} generated for ${area.name} on ${date}. ${totalUsers} customers, ${totalMilkLitres}L milk.`,
    areaId,
    meta: {
      manifest_id: manifestId,
      date,
      area_name: area.name,
      total_users: totalUsers,
      total_milk_litres: totalMilkLitres,
      total_extra_items: totalExtraItems,
      extra_items_summary: extraItemsSummary,
      generated_by: generatedBy,
      status,
      source,
    },
  });

  return result;
}

/**
 * Render a single order row in the PDF.
 */
function renderOrderRow(doc, order, idx) {
  if (doc.y > 700) doc.addPage();

  doc.fontSize(10).font('Helvetica-Bold');
  doc.text(`${idx + 1}. ${order.userName}  |  ${order.phone}`);
  doc.font('Helvetica').fontSize(9);
  doc.text(`   Address: ${order.address}`);

  if (order.milk) {
    doc.text(
      `   Milk: ${order.milk.milk_type} - ${order.milk.quantity_litres}L @ Rs.${order.milk.price_per_litre}/L = Rs.${order.milk.total.toFixed(2)}`
    );
  }

  if (order.extraItems.length > 0) {
    doc.text('   Extra Items:');
    order.extraItems.forEach((item) => {
      doc.text(`     - ${item.product_name} x${item.quantity} (${item.unit}) = Rs.${item.total.toFixed(2)}`);
    });
  }

  doc.text(`   Order Total: Rs.${order.totalAmount.toFixed(2)}`);
  doc.moveDown(0.5);
}

/**
 * Generate PDF document with separate morning and evening sections.
 */
function generatePDF(filePath, data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(data.isPreview ? 'Dairy Delivery Manifest Preview' : 'Dairy Delivery Manifest', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`Area: ${data.area}`, { align: 'center' });
    doc.text(`Delivery Date: ${data.date}`, { align: 'center' });
    if (data.isPreview) {
      doc.moveDown(0.25);
      doc.fontSize(9).fillColor('#a16207').text(
        'Live preview from current subscriptions and carts. Final delivery orders are created at the scheduled generation time.',
        { align: 'center' }
      );
      doc.fillColor('black');
    }
    doc.moveDown(1);

    // Summary
    doc.fontSize(11).font('Helvetica-Bold').text('Summary');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Total Customers: ${data.totalUsers}`);
    doc.text(`Total Milk: ${data.totalMilkLitres} litres`);
    doc.text(`Total Extra Items: ${data.totalExtraItems}`);
    if (data.extraItemsSummary.length > 0) {
      doc.text('Extra Items Breakdown:');
      data.extraItemsSummary.forEach((item) => {
        doc.text(`  - ${formatExtraItemSummaryLine(item)}`);
      });
    }
    doc.text(`Total Amount: Rs. ${data.totalAmount.toFixed(2)}`);
    doc.moveDown(0.5);

    // Slot summary table
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Morning Deliveries: ${data.morningUsers} customers  |  ${data.morningMilkLitres}L milk`);
    doc.text(`Evening Deliveries: ${data.eveningUsers} customers  |  ${data.eveningMilkLitres}L milk`);
    doc.moveDown(1);

    // ── Morning Section ──────────────────────────────────────────────────
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a6faf').text('MORNING SLOT', { align: 'center' });
    doc.fillColor('black').moveDown(0.5);

    if (data.morningOrders.length === 0) {
      doc.fontSize(10).font('Helvetica').text('No morning deliveries for this date.', { align: 'center' });
    } else {
      data.morningOrders.forEach((order, idx) => renderOrderRow(doc, order, idx));
    }

    doc.moveDown(1);

    // ── Evening Section ──────────────────────────────────────────────────
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#af6f1a').text('EVENING SLOT', { align: 'center' });
    doc.fillColor('black').moveDown(0.5);

    if (data.eveningOrders.length === 0) {
      doc.fontSize(10).font('Helvetica').text('No evening deliveries for this date.', { align: 'center' });
    } else {
      data.eveningOrders.forEach((order, idx) => renderOrderRow(doc, order, idx));
    }

    // Footer
    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).text(`Generated: ${new Date().toISOString()}`, { align: 'right' });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

/**
 * List manifests for an area.
 */
async function listManifests(areaId, month) {
  let query = db.collection('manifests').where('area_id', '==', areaId);

  if (month) {
    const startDate = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const nextMon = mon === 12 ? 1 : mon + 1;
    const nextYear = mon === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMon).padStart(2, '0')}-01`;
    query = query.where('date', '>=', startDate).where('date', '<', endDate);
  }

  const snap = await query.get();
  return snap.docs
    .map((doc) => serializeManifest(doc))
    .sort((a, b) => (b.date > a.date ? 1 : -1));
}

/**
 * Get a short-lived signed URL for downloading a manifest PDF from Storage.
 */
async function getManifestSignedUrl(manifestId, areaId) {
  const doc = await db.collection('manifests').doc(manifestId).get();
  if (!doc.exists || doc.data().area_id !== areaId) return null;

  const storagePath = doc.data().pdf_storage_path;
  if (!storagePath) return null;

  const [url] = await bucket.file(storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });
  return { url, filename: path.basename(storagePath) };
}

/**
 * Get the next-day manifest status for an area.
 * Returns the manifest record if it exists, along with window info.
 */
async function getNextDayStatus(areaId) {
  const window = await manifestSettings.getNextDayManifestWindow(areaId);

  const snap = await db
    .collection('manifests')
    .where('area_id', '==', areaId)
    .where('date', '==', window.deliveryDate)
    .limit(1)
    .get();

  const manifest = snap.empty ? null : serializeManifest(snap.docs[0]);

  return {
    delivery_date: window.deliveryDate,
    is_ready: window.isReady,
    cutoff_time: window.cutoffTime,
    cron_time: window.cronTime,
    generation_time: window.generationTime,
    timezone: window.timezone,
    final_manifest_ready: Boolean(manifest && manifest.is_final),
    preview_available: Boolean(manifest && !manifest.is_final),
    manifest: manifest || null,
  };
}

module.exports = {
  generateManifest,
  generateLivePreview,
  buildLivePreviewRows,
  listManifests,
  getManifestSignedUrl,
  getNextDayStatus,
};
