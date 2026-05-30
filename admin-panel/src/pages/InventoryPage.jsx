import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import SearchField from '../components/SearchField';
import { matchesSearch } from '../utils/search';
import {
  AlertCircle, Building2, ClipboardList, History, IndianRupee, Package,
  Pencil, Plus, RefreshCw, Trash2, X,
} from 'lucide-react';

const EMPTY_PRODUCT = { name: '', sku: '', unit: '', notes: '' };
const EMPTY_VENDOR = {
  name: '', contact_person: '', phone: '', email: '', address: '', notes: '',
};

function today() {
  return new Date().toLocaleDateString('en-CA');
}

function emptyPurchase() {
  return {
    product_id: '',
    vendor_id: '',
    quantity: '',
    amount_paid: '',
    purchased_on: today(),
    notes: '',
  };
}

function money(value) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateLabel(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function timeLabel(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function SectionMessage({ icon: Icon = Package, title, detail }) {
  return (
    <div className="card p-12 text-center">
      {createElement(Icon, { size: 36, className: 'text-slate-300 mx-auto mb-3' })}
      <p className="font-semibold text-slate-600">{title}</p>
      {detail && <p className="text-sm text-slate-400 mt-1">{detail}</p>}
    </div>
  );
}

export default function InventoryPage() {
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState({ totals: {}, products: [] });
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);
  const [editingVendor, setEditingVendor] = useState(null);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');

  const [purchaseForm, setPurchaseForm] = useState(emptyPurchase);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');

  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [vendorHistory, setVendorHistory] = useState(null);
  const [vendorHistoryLoading, setVendorHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [dashRes, productRes, vendorRes, purchaseRes, logRes] = await Promise.all([
        api.get('/inventory/dashboard'),
        api.get('/inventory/products'),
        api.get('/inventory/vendors'),
        api.get('/inventory/purchases'),
        api.get('/inventory/logs?limit=150'),
      ]);
      setDashboard(dashRes.data.data);
      setProducts(productRes.data.data.products || []);
      setVendors(vendorRes.data.data.vendors || []);
      setPurchases(purchaseRes.data.data.purchases || []);
      setLogs(logRes.data.data.logs || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load stock ledger data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setPurchaseForm((current) => ({
      ...current,
      product_id: products.some((product) => product.id === current.product_id)
        ? current.product_id
        : products[0]?.id || '',
      vendor_id: vendors.some((vendor) => vendor.id === current.vendor_id)
        ? current.vendor_id
        : vendors[0]?.id || '',
    }));
  }, [products, vendors]);

  async function mutate(work, message) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await work();
      setNotice(message);
      setHistory(null);
      setVendorHistory(null);
      await load(true);
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'The inventory update failed');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function addProduct() {
    setProductForm(EMPTY_PRODUCT);
    setEditingProduct(null);
    setShowProductForm(true);
  }

  function editProduct(product) {
    setProductForm({
      name: product.name || '',
      sku: product.sku || '',
      unit: product.unit || '',
      notes: product.notes || '',
    });
    setEditingProduct(product.id);
    setShowProductForm(true);
  }

  async function submitProduct(event) {
    event.preventDefault();
    if (!productForm.name.trim()) {
      setError('Product name is required');
      return;
    }
    const success = await mutate(
      () => editingProduct
        ? api.put(`/inventory/products/${editingProduct}`, productForm)
        : api.post('/inventory/products', productForm),
      editingProduct ? 'Product updated.' : 'Product added to the stock catalog.'
    );
    if (success) {
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm(EMPTY_PRODUCT);
    }
  }

  async function removeProduct(product) {
    if (!window.confirm(`Delete ${product.name} from the stock catalog?`)) return;
    await mutate(() => api.delete(`/inventory/products/${product.id}`), 'Product deleted.');
  }

  function addVendor() {
    setVendorForm(EMPTY_VENDOR);
    setEditingVendor(null);
    setShowVendorForm(true);
  }

  function editVendor(vendor) {
    setVendorForm({
      name: vendor.name || '',
      contact_person: vendor.contact_person || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      address: vendor.address || '',
      notes: vendor.notes || '',
    });
    setEditingVendor(vendor.id);
    setShowVendorForm(true);
  }

  async function submitVendor(event) {
    event.preventDefault();
    if (!vendorForm.name.trim()) {
      setError('Vendor name is required');
      return;
    }
    const success = await mutate(
      () => editingVendor
        ? api.put(`/inventory/vendors/${editingVendor}`, vendorForm)
        : api.post('/inventory/vendors', vendorForm),
      editingVendor ? 'Vendor updated.' : 'Vendor contact added.'
    );
    if (success) {
      setShowVendorForm(false);
      setEditingVendor(null);
      setVendorForm(EMPTY_VENDOR);
    }
  }

  async function removeVendor(vendor) {
    if (!window.confirm(`Delete ${vendor.name} from vendor contacts?`)) return;
    await mutate(() => api.delete(`/inventory/vendors/${vendor.id}`), 'Vendor deleted.');
  }

  function addPurchase() {
    setPurchaseForm({
      ...emptyPurchase(),
      product_id: products[0]?.id || '',
      vendor_id: vendors[0]?.id || '',
    });
    setEditingPurchase(null);
    setShowPurchaseForm(true);
  }

  function editPurchase(purchase) {
    setPurchaseForm({
      product_id: purchase.product_id,
      vendor_id: purchase.vendor_id,
      quantity: String(purchase.quantity),
      amount_paid: String(purchase.amount_paid),
      purchased_on: purchase.purchased_on,
      notes: purchase.notes || '',
    });
    setEditingPurchase(purchase.id);
    setShowPurchaseForm(true);
  }

  async function submitPurchase(event) {
    event.preventDefault();
    if (!purchaseForm.product_id || !purchaseForm.vendor_id) {
      setError('Add a product and vendor before recording a purchase');
      return;
    }
    const payload = {
      ...purchaseForm,
      quantity: Number(purchaseForm.quantity),
      amount_paid: Number(purchaseForm.amount_paid),
    };
    const success = await mutate(
      () => editingPurchase
        ? api.put(`/inventory/purchases/${editingPurchase}`, payload)
        : api.post('/inventory/purchases', payload),
      editingPurchase ? 'Purchase corrected.' : 'Purchase added to the stock ledger.'
    );
    if (success) {
      setShowPurchaseForm(false);
      setEditingPurchase(null);
      setPurchaseForm(emptyPurchase());
    }
  }

  async function removePurchase(purchase) {
    if (!window.confirm(`Delete the purchase entry for ${purchase.product_name}?`)) return;
    await mutate(() => api.delete(`/inventory/purchases/${purchase.id}`), 'Purchase deleted.');
  }

  async function openHistory(product) {
    setHistoryLoading(true);
    setError('');
    try {
      const res = await api.get(`/inventory/products/${product.id}/history`);
      setHistory(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load purchase history');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openVendorHistory(vendor) {
    setVendorHistoryLoading(true);
    setError('');
    try {
      const res = await api.get(`/inventory/purchases?vendor_id=${vendor.id}`);
      const vendorPurchases = res.data.data.purchases || [];
      setVendorHistory({
        vendor,
        purchases: vendorPurchases,
        summary: {
          purchase_count: vendorPurchases.length,
          total_quantity: vendorPurchases.reduce((sum, purchase) => sum + Number(purchase.quantity || 0), 0),
          total_amount_paid: vendorPurchases.reduce((sum, purchase) => sum + Number(purchase.amount_paid || 0), 0),
        },
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load vendor transaction history');
    } finally {
      setVendorHistoryLoading(false);
    }
  }

  const filteredProducts = useMemo(() => products.filter((product) => matchesSearch(productSearch, [
    product.name, product.sku, product.unit, product.notes,
  ])), [productSearch, products]);

  const filteredVendors = useMemo(() => vendors.filter((vendor) => matchesSearch(vendorSearch, [
    vendor.name, vendor.contact_person, vendor.phone, vendor.email, vendor.address,
  ])), [vendorSearch, vendors]);

  const filteredPurchases = useMemo(() => purchases.filter((purchase) => matchesSearch(purchaseSearch, [
    purchase.product_name, purchase.vendor_name, purchase.quantity, purchase.amount_paid, purchase.purchased_on,
  ])), [purchaseSearch, purchases]);

  const filteredLogs = useMemo(() => logs.filter((log) => matchesSearch(logSearch, [
    log.type, log.title, log.message, JSON.stringify(log.meta || {}),
  ])), [logSearch, logs]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Package },
    { id: 'products', label: 'Products', icon: ClipboardList },
    { id: 'vendors', label: 'Vendors', icon: Building2 },
    { id: 'purchases', label: 'Purchases', icon: IndianRupee },
    { id: 'logs', label: 'Activity Logs', icon: History },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="card h-24 bg-slate-50 animate-pulse" />
          ))}
        </div>
        <div className="card h-72 bg-slate-50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Stock Ledger</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Independent purchase tracking for your own stocked items and vendors
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} className="btn-secondary btn-sm">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {createElement(Icon, { size: 13 })}
            {label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 text-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-emerald-600"><X size={15} /></button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-100 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {tab === 'dashboard' && (
        <DashboardTab
          dashboard={dashboard}
          history={history}
          historyLoading={historyLoading}
          onOpenHistory={openHistory}
          onCloseHistory={() => setHistory(null)}
        />
      )}
      {tab === 'products' && (
        <ProductsTab
          products={filteredProducts}
          search={productSearch}
          onSearch={setProductSearch}
          showForm={showProductForm}
          form={productForm}
          editing={editingProduct}
          saving={saving}
          onAdd={addProduct}
          onEdit={editProduct}
          onDelete={removeProduct}
          onFormChange={setProductForm}
          onSubmit={submitProduct}
          onCancel={() => setShowProductForm(false)}
        />
      )}
      {tab === 'vendors' && (
        <VendorsTab
          vendors={filteredVendors}
          search={vendorSearch}
          onSearch={setVendorSearch}
          showForm={showVendorForm}
          form={vendorForm}
          editing={editingVendor}
          saving={saving}
          onAdd={addVendor}
          onEdit={editVendor}
          onDelete={removeVendor}
          onOpenHistory={openVendorHistory}
          onFormChange={setVendorForm}
          onSubmit={submitVendor}
          onCancel={() => setShowVendorForm(false)}
          history={vendorHistory}
          historyLoading={vendorHistoryLoading}
          onCloseHistory={() => setVendorHistory(null)}
        />
      )}
      {tab === 'purchases' && (
        <PurchasesTab
          purchases={filteredPurchases}
          products={products}
          vendors={vendors}
          search={purchaseSearch}
          onSearch={setPurchaseSearch}
          showForm={showPurchaseForm}
          form={purchaseForm}
          editing={editingPurchase}
          saving={saving}
          onAdd={addPurchase}
          onEdit={editPurchase}
          onDelete={removePurchase}
          onFormChange={setPurchaseForm}
          onSubmit={submitPurchase}
          onCancel={() => setShowPurchaseForm(false)}
        />
      )}
      {tab === 'logs' && <LogsTab logs={filteredLogs} search={logSearch} onSearch={setLogSearch} />}
    </div>
  );
}

function DashboardTab({ dashboard, history, historyLoading, onOpenHistory, onCloseHistory }) {
  const totals = dashboard.totals || {};
  const cards = [
    { label: 'Products', value: totals.products || 0, color: 'text-blue-700 bg-blue-50' },
    { label: 'Vendors', value: totals.vendors || 0, color: 'text-purple-700 bg-purple-50' },
    { label: 'Units Purchased', value: totals.quantity || 0, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'Amount Paid', value: money(totals.amount_paid), color: 'text-amber-700 bg-amber-50' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div key={card.label} className={`${card.color} rounded-2xl p-4`}>
            <p className="text-xl sm:text-2xl font-bold">{card.value}</p>
            <p className="text-[11px] mt-1 uppercase tracking-wide font-semibold opacity-70">{card.label}</p>
          </div>
        ))}
      </div>

      {dashboard.products.length === 0 ? (
        <SectionMessage
          title="No stock products configured"
          detail="Add products and vendors, then begin recording purchases."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="font-semibold text-slate-800">Product Purchase Summary</p>
            <p className="text-xs text-slate-400 mt-0.5">Select a product to view its purchase history.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Purchases</th>
                  <th>Quantity</th>
                  <th>Paid</th>
                  <th>Last Purchased</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.products.map((product) => (
                  <tr key={product.id} className="cursor-pointer" onClick={() => onOpenHistory(product)}>
                    <td>
                      <p className="font-semibold text-slate-800">{product.name}</p>
                      <p className="text-xs text-slate-400">{product.unit || 'No unit set'}</p>
                    </td>
                    <td>{product.purchase_count}</td>
                    <td className="font-semibold text-slate-700">{product.total_quantity}</td>
                    <td className="font-semibold text-slate-700">{money(product.total_amount_paid)}</td>
                    <td className="text-slate-500">{dateLabel(product.last_purchased_on)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(historyLoading || history) && (
        <div className="card p-4 sm:p-5">
          {historyLoading ? (
            <div className="h-28 bg-slate-50 animate-pulse rounded-xl" />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800">{history.product.name} History</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {history.summary.purchase_count} entries, {history.summary.total_quantity} units, {money(history.summary.total_amount_paid)} paid
                  </p>
                </div>
                <button className="btn-icon" onClick={onCloseHistory}><X size={15} /></button>
              </div>
              {history.purchases.length === 0 ? (
                <p className="text-sm text-slate-400">No purchases have been recorded for this product.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Vendor</th>
                        <th>Quantity</th>
                        <th>Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.purchases.map((purchase) => (
                        <tr key={purchase.id}>
                          <td>{dateLabel(purchase.purchased_on)}</td>
                          <td className="font-semibold text-slate-700">{purchase.vendor_name}</td>
                          <td>{purchase.quantity} {purchase.product_unit}</td>
                          <td>{money(purchase.amount_paid)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProductsTab({
  products, search, onSearch, showForm, form, editing, saving,
  onAdd, onEdit, onDelete, onFormChange, onSubmit, onCancel,
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SearchField value={search} onChange={onSearch} placeholder="Search stock products..." className="max-w-lg" />
        <button className="btn-primary btn-sm" onClick={onAdd}><Plus size={14} /> Add Product</button>
      </div>
      {showForm && (
        <form onSubmit={onSubmit} className="card p-4 sm:p-5 space-y-4">
          <p className="font-semibold text-slate-800">{editing ? 'Edit Product' : 'Add Stock Product'}</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Product name *">
              <input className="input" value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="SKU / code">
              <input className="input" value={form.sku} onChange={(e) => onFormChange({ ...form, sku: e.target.value })} />
            </Field>
            <Field label="Unit">
              <input className="input" placeholder="kg, litre, box" value={form.unit} onChange={(e) => onFormChange({ ...form, unit: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="input min-h-20" value={form.notes} onChange={(e) => onFormChange({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{editing ? 'Save Product' : 'Add Product'}</button>
          </div>
        </form>
      )}
      {products.length === 0 ? (
        <SectionMessage title="No products found" detail="Create a product to use it in purchase entries." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Unit</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="font-semibold text-slate-800">{product.name}</td>
                  <td className="text-slate-500">{product.sku || '-'}</td>
                  <td className="text-slate-500">{product.unit || '-'}</td>
                  <td className="text-slate-500 max-w-xs truncate">{product.notes || '-'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn-icon" onClick={() => onEdit(product)}><Pencil size={14} /></button>
                      <button className="btn-icon text-red-500" onClick={() => onDelete(product)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VendorsTab({
  vendors, search, onSearch, showForm, form, editing, saving,
  onAdd, onEdit, onDelete, onOpenHistory, onFormChange, onSubmit, onCancel,
  history, historyLoading, onCloseHistory,
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SearchField value={search} onChange={onSearch} placeholder="Search vendor contacts..." className="max-w-lg" />
        <button className="btn-primary btn-sm" onClick={onAdd}><Plus size={14} /> Add Vendor</button>
      </div>
      {showForm && (
        <form onSubmit={onSubmit} className="card p-4 sm:p-5 space-y-4">
          <p className="font-semibold text-slate-800">{editing ? 'Edit Vendor' : 'Add Vendor Contact'}</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Vendor name *">
              <input className="input" value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Contact person">
              <input className="input" value={form.contact_person} onChange={(e) => onFormChange({ ...form, contact_person: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className="input" value={form.phone} onChange={(e) => onFormChange({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={form.email} onChange={(e) => onFormChange({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Address">
              <input className="input" value={form.address} onChange={(e) => onFormChange({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Notes">
              <input className="input" value={form.notes} onChange={(e) => onFormChange({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{editing ? 'Save Vendor' : 'Add Vendor'}</button>
          </div>
        </form>
      )}
      {vendors.length === 0 ? (
        <SectionMessage icon={Building2} title="No vendors found" detail="Add vendor contacts before recording purchases." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Vendor</th><th>Contact</th><th>Phone</th><th>Email</th><th>Actions</th></tr></thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td className="font-semibold text-slate-800">{vendor.name}</td>
                  <td className="text-slate-500">{vendor.contact_person || '-'}</td>
                  <td className="text-slate-500">{vendor.phone || '-'}</td>
                  <td className="text-slate-500">{vendor.email || '-'}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button className="btn-ghost btn-sm" onClick={() => onOpenHistory(vendor)}>
                        <History size={13} />
                        History
                      </button>
                      <button className="btn-icon" onClick={() => onEdit(vendor)}><Pencil size={14} /></button>
                      <button className="btn-icon text-red-500" onClick={() => onDelete(vendor)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(historyLoading || history) && (
        <div className="card p-4 sm:p-5">
          {historyLoading ? (
            <div className="h-28 bg-slate-50 animate-pulse rounded-xl" />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800">{history.vendor.name} Transaction History</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {history.summary.purchase_count} transactions, {history.summary.total_quantity} units, {money(history.summary.total_amount_paid)} paid
                  </p>
                </div>
                <button className="btn-icon" onClick={onCloseHistory}><X size={15} /></button>
              </div>
              {history.purchases.length === 0 ? (
                <p className="text-sm text-slate-400">No transactions have been recorded with this vendor.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Amount Paid</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.purchases.map((purchase) => (
                        <tr key={purchase.id}>
                          <td>{dateLabel(purchase.purchased_on)}</td>
                          <td className="font-semibold text-slate-700">{purchase.product_name}</td>
                          <td>{purchase.quantity} {purchase.product_unit}</td>
                          <td>{money(purchase.amount_paid)}</td>
                          <td className="text-slate-500 max-w-xs truncate">{purchase.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PurchasesTab({
  purchases, products, vendors, search, onSearch, showForm, form, editing, saving,
  onAdd, onEdit, onDelete, onFormChange, onSubmit, onCancel,
}) {
  const ready = products.length > 0 && vendors.length > 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SearchField value={search} onChange={onSearch} placeholder="Search purchase records..." className="max-w-lg" />
        <button className="btn-primary btn-sm" onClick={onAdd} disabled={!ready}><Plus size={14} /> Record Purchase</button>
      </div>
      {!ready && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Add at least one product and one vendor before recording stock purchases.
        </div>
      )}
      {showForm && ready && (
        <form onSubmit={onSubmit} className="card p-4 sm:p-5 space-y-4">
          <p className="font-semibold text-slate-800">{editing ? 'Correct Purchase Record' : 'Record Stock Purchase'}</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Product *">
              <select className="select" value={form.product_id} onChange={(e) => onFormChange({ ...form, product_id: e.target.value })} required>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </Field>
            <Field label="Vendor *">
              <select className="select" value={form.vendor_id} onChange={(e) => onFormChange({ ...form, vendor_id: e.target.value })} required>
                {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
              </select>
            </Field>
            <Field label="Purchase date *">
              <input className="input" type="date" value={form.purchased_on} onChange={(e) => onFormChange({ ...form, purchased_on: e.target.value })} required />
            </Field>
            <Field label="Quantity *">
              <input className="input" type="number" step="0.01" min="0.01" value={form.quantity} onChange={(e) => onFormChange({ ...form, quantity: e.target.value })} required />
            </Field>
            <Field label="Amount paid *">
              <input className="input" type="number" step="0.01" min="0" value={form.amount_paid} onChange={(e) => onFormChange({ ...form, amount_paid: e.target.value })} required />
            </Field>
            <Field label="Notes">
              <input className="input" value={form.notes} onChange={(e) => onFormChange({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{editing ? 'Save Correction' : 'Record Purchase'}</button>
          </div>
        </form>
      )}
      {purchases.length === 0 ? (
        <SectionMessage icon={IndianRupee} title="No purchases recorded" detail="Purchase entries will build your product history and spend totals." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Product</th><th>Vendor</th><th>Quantity</th><th>Amount Paid</th><th>Actions</th></tr></thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="text-slate-500">{dateLabel(purchase.purchased_on)}</td>
                  <td className="font-semibold text-slate-800">{purchase.product_name}</td>
                  <td className="text-slate-600">{purchase.vendor_name}</td>
                  <td>{purchase.quantity} {purchase.product_unit}</td>
                  <td className="font-semibold text-slate-700">{money(purchase.amount_paid)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn-icon" onClick={() => onEdit(purchase)}><Pencil size={14} /></button>
                      <button className="btn-icon text-red-500" onClick={() => onDelete(purchase)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LogsTab({ logs, search, onSearch }) {
  return (
    <div className="space-y-4">
      <SearchField value={search} onChange={onSearch} placeholder="Search stock ledger activity..." className="max-w-lg" />
      {logs.length === 0 ? (
        <SectionMessage icon={History} title="No stock activity logged" detail="Catalog and purchase activity will appear here." />
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="card p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <History size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-800 text-sm">{log.title}</p>
                  <span className="badge badge-blue">{String(log.type || '').replace(/_/g, ' ')}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{log.message}</p>
                <p className="text-xs text-slate-400 mt-1.5">{timeLabel(log.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
