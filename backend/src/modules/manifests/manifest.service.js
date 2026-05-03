const { db, admin, bucket } = require('../../config/firebase');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dateUtil = require('../../utils/date');
const { logActivity } = require('../../utils/activityLog');

function serializeManifest(doc) {
  const d = doc.data ? doc.data() : doc;
  const id = doc.id || d.id;
  return {
    id,
    ...d,
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

/**
 * Generate a delivery manifest for a specific area and date.
 * Called by the nightly cron job or manual admin trigger.
 */
async function generateManifest(areaId, date, generatedBy = 'system') {
  // 1. Get area info
  const areaDoc = await db.collection('areas').doc(areaId).get();
  if (!areaDoc.exists) throw new Error(`Area ${areaId} not found`);
  const area = areaDoc.data();

  // 2. Get all orders for this area + date
  const ordersSnap = await db
    .collection('orders')
    .where('area_id', '==', areaId)
    .where('date', '==', date)
    .get();

  const orders = [];
  for (const orderDoc of ordersSnap.docs) {
    const orderData = orderDoc.data();

    // Get user details
    const userDoc = await db.collection('users').doc(orderData.user_id).get();
    const userData = userDoc.exists ? userDoc.data() : { name: 'Unknown', phone: 'N/A', address: {} };

    orders.push({
      orderId: orderDoc.id,
      userName: userData.name || 'Unknown',
      phone: userData.phone || 'N/A',
      address: userData.address
        ? `${userData.address.line1 || ''}${userData.address.line2 ? ', ' + userData.address.line2 : ''}${userData.address.landmark ? ', ' + userData.address.landmark : ''}`
        : 'N/A',
      deliverySlot: orderData.delivery_slot || 'morning',
      milk: orderData.milk,
      extraItems: orderData.extra_items || [],
      totalAmount: orderData.total_amount,
    });
  }

  // 3. Split orders into slot groups.
  //    'both' subscribers appear in BOTH morning and evening sections.
  const morningOrders = orders.filter((o) => o.deliverySlot === 'morning' || o.deliverySlot === 'both');
  const eveningOrders = orders.filter((o) => o.deliverySlot === 'evening' || o.deliverySlot === 'both');

  // 4. Calculate totals
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

  // 5. Generate PDF to a temp file, then upload to Firebase Storage
  const fileName = `${area.slug}_${date}.pdf`;
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
  });

  // 6. Upload PDF to Firebase Storage, then clean up temp file
  const storagePath = `manifests/${fileName}`;
  await bucket.upload(filePath, {
    destination: storagePath,
    metadata: { contentType: 'application/pdf' },
  });
  fs.unlink(filePath, () => {}); // clean up temp file (fire-and-forget)

  // 7. Save/update manifest record
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
    status: 'ready',
    generated_at: admin.firestore.FieldValue.serverTimestamp(),
    generated_by: generatedBy,
  };

  let manifestId;
  if (existingSnap.empty) {
    const docRef = await db.collection('manifests').add(manifestData);
    manifestId = docRef.id;
  } else {
    manifestId = existingSnap.docs[0].id;
    await existingSnap.docs[0].ref.update(manifestData);
  }

  const result = {
    id: manifestId,
    ...manifestData,
    generated_at: new Date().toISOString(),
    pdf_path: undefined,
    pdf_filename: fileName,
    status: 'ready',
  };

  // Log manifest generation
  await logActivity({
    type: 'manifest_generated',
    title: 'Manifest Generated',
    message: `Delivery manifest generated for ${area.name} on ${date}. ${totalUsers} customers, ${totalMilkLitres}L milk.`,
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
    },
  });

  return result;

  // Log manifest generation (fire-and-forget after return is unreachable, so log before)
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
    doc.fontSize(20).font('Helvetica-Bold').text('Dairy Delivery Manifest', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`Area: ${data.area}`, { align: 'center' });
    doc.text(`Delivery Date: ${data.date}`, { align: 'center' });
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
  const window = dateUtil.nextDayManifestWindow();

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
    cron_time: window.cronTime,
    manifest: manifest || null,
  };
}

module.exports = { generateManifest, listManifests, getManifestSignedUrl, getNextDayStatus };
