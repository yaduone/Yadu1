// Customer statement: balance math, area scoping and the PDF / CSV / Excel renderers.
// Firestore is mocked — nothing here touches a real database.

const mockCollections = {};

function mockSnap(docs) {
  return { docs: docs.map(([id, data]) => ({ id, data: () => data })) };
}

jest.mock('../src/config/firebase', () => ({
  db: {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          const row = (mockCollections[name] || []).find(([docId]) => docId === id);
          return { exists: !!row, id, data: () => (row ? row[1] : undefined) };
        },
      }),
      where: (field, op, value) => ({
        get: async () => mockSnap((mockCollections[name] || []).filter(([, d]) => d[field] === value)),
      }),
    }),
  },
  admin: { firestore: { FieldValue: { serverTimestamp: jest.fn() } } },
}));

const ExcelJS = require('exceljs');
const { buildStatement, getUserStatement, validateRange } = require('../src/modules/dues/dueReport.service');
const { toCsv, toXlsx, toPdf, reportFilename } = require('../src/modules/dues/dueReport.export');

const ts = (iso) => ({ toDate: () => new Date(iso) });

const milk = (litres, rate = 60) => ({
  milk_type: 'cow', quantity_litres: litres, price_per_litre: rate, total: litres * rate,
});

function fixture() {
  return {
    users: [['u1', { name: 'Asha Verma', phone: '9876500000', area_id: 'a1', address: { line1: '12 MG Road', pincode: '110001' } }]],
    areas: [['a1', { name: 'Sector 9' }]],
    orders: [
      // Before the period: 120 billed, one not delivered.
      ['o1', { user_id: 'u1', date: '2026-09-29', status: 'delivered', milk: milk(1), extra_items: [], total_amount: 60 }],
      ['o2', { user_id: 'u1', date: '2026-09-30', status: 'delivered', milk: milk(1), extra_items: [], total_amount: 60 }],
      ['o3', { user_id: 'u1', date: '2026-09-28', status: 'not_delivered', non_delivery_reason: 'skipped', milk: null, extra_items: [], total_amount: 0 }],
      // In the period.
      ['o4', {
        user_id: 'u1', date: '2026-10-01', status: 'delivered', delivery_slot: 'morning', milk: milk(2),
        extra_items: [{ product_name: 'Paneer', quantity: 1, unit: '200g', price: 90, total: 90 }], total_amount: 210,
      }],
      ['o5', { user_id: 'u1', date: '2026-10-02', status: 'cancelled', milk: milk(1), extra_items: [], total_amount: 60 }],
      // Past and still pending: shown as not delivered, never billed.
      ['o6', { user_id: 'u1', date: '2026-10-03', status: 'pending', milk: milk(1), extra_items: [], total_amount: 60 }],
      // After the period.
      ['o7', { user_id: 'u1', date: '2026-11-01', status: 'delivered', milk: milk(1), extra_items: [], total_amount: 60 }],
      // Another customer.
      ['x1', { user_id: 'u2', date: '2026-10-01', status: 'delivered', milk: milk(5), extra_items: [], total_amount: 300 }],
    ],
    payments: [
      ['p1', { user_id: 'u1', payment_date: '2026-09-30', amount: 50, method: 'cash' }],
      ['p2', { user_id: 'u1', payment_date: '2026-10-01', amount: 100, method: 'upi', notes: '=HYPERLINK("x")' }],
    ],
    due_adjustments: [
      // Old balance carried in before the period.
      ['d1', { user_id: 'u1', date: '2026-09-01', type: 'charge', amount: 40, category: 'previous_balance', created_at: ts('2026-09-01T05:00:00Z') }],
      // Added in the period, then reversed in the period.
      ['d2', {
        user_id: 'u1', date: '2026-10-02', type: 'charge', amount: 25, category: 'late_fee', note: 'Late payment',
        voided: true, voided_at: ts('2026-10-04T06:00:00Z'), void_reason: 'Waived', created_at: ts('2026-10-02T05:00:00Z'),
        created_by: { username: 'admin1' },
      }],
      // A discount in the period.
      ['d3', { user_id: 'u1', date: '2026-10-05', type: 'credit', amount: 10, category: 'discount', created_at: ts('2026-10-05T05:00:00Z') }],
      // A delivered instant order moved onto the due.
      ['d4', {
        user_id: 'u1', date: '2026-10-06', type: 'charge', amount: 55, category: 'instant_order',
        reference_type: 'instant_order', reference_id: 'i2', created_at: ts('2026-10-06T05:00:00Z'),
      }],
    ],
    instant_orders: [
      ['i1', {
        user_id: 'u1', date: '2026-10-02', status: 'delivered', items: [{ product_name: 'Curd', quantity: 2, unit: '500g', price: 30, total: 60 }],
        items_total: 60, delivery_charge: 15, extra_charges: [{ name: 'Platform fee', amount: 5 }], extra_charges_total: 5, total_amount: 80,
        placed_at: ts('2026-10-02T04:00:00Z'),
      }],
      ['i2', {
        user_id: 'u1', date: '2026-10-06', status: 'delivered', items: [{ product_name: 'Ghee', quantity: 1, unit: '200ml', price: 55, total: 55 }],
        items_total: 55, delivery_charge: 0, extra_charges: [], extra_charges_total: 0, total_amount: 55, due_adjustment_id: 'd4',
      }],
      ['i3', { user_id: 'u1', date: '2026-10-07', status: 'rejected', items: [], total_amount: 30, rejection_reason: 'Out of stock' }],
    ],
    due_amounts: [['u1', { user_id: 'u1', total_billed: 550, total_paid: 150, due_amount: 400 }]],
  };
}

function load(data) {
  Object.keys(mockCollections).forEach((k) => delete mockCollections[k]);
  Object.assign(mockCollections, data);
}

const asRecords = (rows, userId = 'u1') => rows.filter(([, d]) => d.user_id === userId).map(([id, d]) => ({ id, data: d }));

function statementFor(from, to, data = fixture()) {
  return buildStatement({
    userId: 'u1',
    user: data.users[0][1],
    areaName: 'Sector 9',
    orders: asRecords(data.orders),
    payments: asRecords(data.payments),
    adjustments: asRecords(data.due_adjustments),
    instantOrders: asRecords(data.instant_orders),
    dueDoc: data.due_amounts[0][1],
    from,
    to,
    today: '2026-11-27',
    generatedAt: new Date('2026-11-27T06:30:00Z'),
  });
}

describe('customer statement', () => {
  test('opening balance counts every move before the period', () => {
    const s = statementFor('2026-10-01', '2026-10-31');
    // 40 old balance + 60 + 60 delivered − 50 paid
    expect(s.summary.opening_balance).toBe(110);
    expect(s.ledger[0]).toMatchObject({ kind: 'opening', date: '2026-10-01', balance: 110 });
  });

  test('period totals and closing balance', () => {
    const s = statementFor('2026-10-01', '2026-10-31');
    expect(s.summary.billed).toBe(210);
    expect(s.summary.paid).toBe(100);
    // charge 25 + 55 added; reversal of 25 and discount 10 credited
    expect(s.summary.adjustment_charges).toBe(80);
    expect(s.summary.adjustment_credits).toBe(35);
    expect(s.summary.total_charges).toBe(290);
    expect(s.summary.total_credits).toBe(135);
    expect(s.summary.closing_balance).toBe(110 + 290 - 135);
    expect(s.ledger[s.ledger.length - 1].balance).toBe(s.summary.closing_balance);
  });

  test('ledger runs in date order with charges before payments on the same day', () => {
    const s = statementFor('2026-10-01', '2026-10-31');
    expect(s.ledger.map((e) => e.kind)).toEqual([
      'opening', 'charge', 'payment', 'adjustment_charge', 'reversal', 'adjustment_credit', 'adjustment_charge',
    ]);
    expect(s.ledger.find((e) => e.kind === 'reversal')).toMatchObject({ date: '2026-10-04', credit: 25, debit: 0 });
  });

  test('order statuses: past pending shows as not delivered and nothing unbilled is charged', () => {
    const s = statementFor('2026-10-01', '2026-10-31');
    expect(s.orders.map((o) => [o.id, o.status, o.billed_amount])).toEqual([
      ['o4', 'delivered', 210],
      ['o5', 'cancelled', 0],
      ['o6', 'not_delivered', 0],
    ]);
    expect(s.orders[2].reason_label).toBe('Not marked delivered');
    expect(s.summary).toMatchObject({ orders_total: 3, orders_delivered: 1, orders_not_delivered: 2, milk_litres_delivered: 2, extras_amount: 90 });
  });

  test('instant orders are listed but only reach the balance through an adjustment', () => {
    const s = statementFor('2026-10-01', '2026-10-31');
    expect(s.instant_orders.map((o) => o.id)).toEqual(['i1', 'i2', 'i3']);
    expect(s.summary.instant_cod_amount).toBe(80);
    expect(s.summary.instant_added_to_due_amount).toBe(55);
    expect(s.instant_orders[1].added_to_due).toBe(true);
  });

  test('a later period opens where the earlier one closed', () => {
    const oct = statementFor('2026-10-01', '2026-10-31');
    const nov = statementFor('2026-11-01', '2026-11-30');
    expect(nov.summary.opening_balance).toBe(oct.summary.closing_balance);
    expect(nov.summary.closing_balance).toBe(oct.summary.closing_balance + 60);
  });

  test('flags a balance that the records do not explain', () => {
    // All-time records: 40 + 60 + 60 + 210 + 60 − 50 − 100 + 25 − 25 − 10 + 55 = 325
    const s = statementFor('2026-10-01', '2026-10-31');
    expect(s.summary.account_balance_today).toBe(400);
    expect(s.summary.unreconciled_adjustment).toBe(75);

    const data = fixture();
    data.due_amounts[0][1].due_amount = 325;
    expect(statementFor('2026-10-01', '2026-10-31', data).summary.unreconciled_adjustment).toBe(0);
  });

  test('validates the date range', () => {
    expect(() => validateRange('2026-10-31', '2026-10-01')).toThrow('on or before');
    expect(() => validateRange('2026-02-30', '2026-03-01')).toThrow('YYYY-MM-DD');
    expect(() => validateRange('2020-01-01', '2026-01-01')).toThrow('3 years');
    expect(() => validateRange('2026-10-01', '2026-10-01')).not.toThrow();
  });
});

describe('getUserStatement', () => {
  beforeEach(() => load(fixture()));

  test('loads only this customer and resolves the area name', async () => {
    const s = await getUserStatement('u1', 'a1', { from: '2026-10-01', to: '2026-10-31' });
    expect(s.customer).toMatchObject({ name: 'Asha Verma', area_name: 'Sector 9', address: '12 MG Road, 110001' });
    expect(s.orders.every((o) => o.id !== 'x1')).toBe(true);
  });

  test('a customer from another area is not found', async () => {
    await expect(getUserStatement('u1', 'other-area', { from: '2026-10-01', to: '2026-10-31' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('statement files', () => {
  const s = statementFor('2026-10-01', '2026-10-31');

  test('CSV has every section and neutralises formula-looking text', () => {
    const csv = toCsv(s).toString('utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    ['SUMMARY', 'LEDGER', 'ORDERS', 'PAYMENTS', 'MANUAL ADJUSTMENTS', 'INSTANT ORDERS'].forEach((section) => {
      expect(csv).toContain(section);
    });
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('Closing balance,265');
  });

  test('Excel workbook has the expected sheets and numbers', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await toXlsx(s));
    expect(wb.worksheets.map((w) => w.name)).toEqual(
      ['Summary', 'Ledger', 'Orders', 'Order items', 'Payments', 'Adjustments', 'Instant orders'],
    );
    const ledger = wb.getWorksheet('Ledger');
    const last = ledger.getRow(ledger.rowCount);
    expect(last.getCell(3).value).toBe('Closing balance');
    expect(last.getCell(6).value).toBe(265);
  });

  test('PDF renders', async () => {
    const pdf = await toPdf(s);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(2000);
  });

  test('PDF paginates a long statement', async () => {
    const data = fixture();
    for (let d = 1; d <= 31; d += 1) {
      const date = `2026-10-${String(d).padStart(2, '0')}`;
      data.orders.push([`bulk${d}`, {
        user_id: 'u1', date, status: 'delivered', delivery_slot: 'both', milk: milk(1.5),
        extra_items: [{ product_name: 'Bread', quantity: 1, unit: 'pack', price: 40, total: 40 }], total_amount: 130,
      }]);
    }
    const pdf = await toPdf(statementFor('2026-10-01', '2026-10-31', data));
    const pages = (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    expect(pages).toBeGreaterThan(1);
  });

  test('file name uses the customer and period', () => {
    expect(reportFilename(s, 'pdf')).toBe('statement_asha-verma_2026-10-01_to_2026-10-31.pdf');
  });
});
