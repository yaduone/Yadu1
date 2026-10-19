import { createElement, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import SearchField from '../components/SearchField';
import { matchesSearch } from '../utils/search';
import {
  ShoppingBag, Repeat, User, Phone, MapPin, Wallet, BellOff, Bell, CalendarClock,
  Plus, Minus, Trash2, Package, Milk, Pause, Play, XCircle, Loader2, AlertTriangle,
  CheckCircle2, X, ArrowLeftRight, Info, SkipForward, RotateCcw, Lock,
} from 'lucide-react';

const MILK_LABELS = { cow: 'Cow', buffalo: 'Buffalo', toned: 'Child Pack' };
const SLOT_LABELS = { morning: 'Morning', evening: 'Evening', both: 'Morning + Evening' };
const SLOTS = ['morning', 'evening', 'both'];
const LITRE_OPTIONS = Array.from({ length: 20 }, (_, i) => (i + 1) * 0.5);
const MAX_UNITS = 50;

const STATUS_BADGE = {
  active: 'badge badge-green',
  paused: 'badge badge-yellow',
  cancelled: 'badge badge-gray',
};

function errorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.error || err?.message || fallback;
}

function isDateChanged(err) {
  return err?.response?.status === 409 && err?.response?.data?.details?.code === 'TARGET_DATE_CHANGED';
}

function newRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function formatDate(isoDate, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!isoDate) return '—';
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-IN', opts);
}

function rupees(value) {
  return `₹${(Number(value) || 0).toFixed(2).replace(/\.00$/, '')}`;
}

function formatAddress(address) {
  if (!address) return null;
  if (typeof address === 'string') return address;
  return [address.line1, address.line2, address.landmark, address.pincode].filter(Boolean).join(', ');
}

function productImage(product) {
  return product?.cover_image_small || product?.cover_image_large || product?.images?.[0] || null;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PlaceOrderPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('user');

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [catalog, setCatalog] = useState({ products: [], categories: [] });

  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');

  const [tab, setTab] = useState('products');
  const [toast, setToast] = useState(null);
  const [dateNotice, setDateNotice] = useState('');
  const toastTimer = useRef(null);

  const showToast = useCallback((message, tone = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    api.get('/users/admin/list')
      .then((res) => setUsers(res.data.data.users || []))
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));

    Promise.all([api.get('/products/all'), api.get('/categories')])
      .then(([prodRes, catRes]) => {
        const products = (prodRes.data.data.products || [])
          // Only what the customer could order for a scheduled delivery themselves.
          .filter((p) => p.is_active && (p.availability || 'scheduled') !== 'instant')
          .sort((a, b) => a.name.localeCompare(b.name));
        setCatalog({ products, categories: catRes.data.data.categories || [] });
      })
      .catch(() => setCatalog({ products: [], categories: [] }));
  }, []);

  const loadOverview = useCallback(async ({ silent = false } = {}) => {
    if (!selectedId) return null;
    if (!silent) setOverviewLoading(true);
    try {
      const res = await api.get(`/admin-orders/customers/${selectedId}`);
      setOverview(res.data.data);
      setOverviewError('');
      return res.data.data;
    } catch (err) {
      setOverviewError(errorMessage(err, 'Failed to load customer'));
      return null;
    } finally {
      if (!silent) setOverviewLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    setOverview(null);
    setDateNotice('');
    loadOverview();
  }, [loadOverview]);

  /**
   * Shared handling for every write: on a cutoff roll-over the server refuses
   * the change, so reload to show the new date and tell the admin why.
   */
  const handleWriteError = useCallback(async (err) => {
    if (isDateChanged(err)) {
      const fresh = await loadOverview({ silent: true });
      setDateNotice(
        `The cutoff passed while this page was open. The next open delivery is now ${formatDate(fresh?.schedule?.target_date || err.response.data.details.target_date)}. Nothing was saved — review and submit again.`
      );
      return;
    }
    showToast(errorMessage(err), 'error');
  }, [loadOverview, showToast]);

  function selectCustomer(id) {
    setSearchParams(id ? { user: id } : {});
    setTab('products');
  }

  const customerName = overview?.customer?.name || 'The customer';

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Order for Customer</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Book products or manage a subscription on a customer&apos;s behalf. Changes appear in their app instantly and they are notified.
          </p>
        </div>
      </div>

      {!selectedId ? (
        <CustomerPicker users={users} loading={usersLoading} onSelect={selectCustomer} />
      ) : (
        <>
          {overviewLoading && !overview && (
            <div className="card p-10 flex items-center justify-center gap-2 text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading customer...</span>
            </div>
          )}

          {overviewError && (
            <div className="card p-4 flex items-center justify-between gap-3 text-sm text-red-600 bg-red-50 border-red-100">
              <span className="flex items-center gap-2"><AlertTriangle size={15} />{overviewError}</span>
              <button type="button" className="btn-secondary btn-sm" onClick={() => selectCustomer(null)}>Choose another customer</button>
            </div>
          )}

          {overview && (
            <>
              <CustomerHeader overview={overview} onChange={() => selectCustomer(null)} />

              {dateNotice && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span className="flex-1">{dateNotice}</span>
                  <button type="button" onClick={() => setDateNotice('')} className="btn-icon p-1 text-amber-700" aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}

              {!overview.customer.is_profile_complete || overview.customer.deletion_requested ? (
                <div className="card p-6 text-sm text-slate-600 flex items-start gap-2.5">
                  <Lock size={16} className="text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {overview.customer.deletion_requested
                      ? 'This customer has requested account deletion, so ordering is disabled.'
                      : 'This customer has not completed their profile (name and address). Orders can be placed once they finish it in the app.'}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <TabButton active={tab === 'products'} onClick={() => setTab('products')} icon={ShoppingBag}>Products</TabButton>
                    <TabButton active={tab === 'subscription'} onClick={() => setTab('subscription')} icon={Repeat}>Subscription</TabButton>
                  </div>

                  {tab === 'products' ? (
                    <ProductsPanel
                      key={overview.customer.id}
                      overview={overview}
                      catalog={catalog}
                      onSaved={async (message) => {
                        setDateNotice('');
                        await loadOverview({ silent: true });
                        showToast(message || `Saved — ${customerName} has been notified`);
                      }}
                      onError={handleWriteError}
                    />
                  ) : (
                    <SubscriptionPanel
                      key={overview.customer.id}
                      overview={overview}
                      onSaved={async (message) => {
                        setDateNotice('');
                        await loadOverview({ silent: true });
                        showToast(message || `Saved — ${customerName} has been notified`);
                      }}
                      onError={handleWriteError}
                    />
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 max-w-sm flex items-start gap-2 rounded-xl px-4 py-3 shadow-lg text-sm animate-slide-in ${
          toast.tone === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
        }`}>
          {toast.tone === 'error' ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn ${active ? 'btn-primary' : 'bg-white border border-slate-200 text-slate-600'}`}
    >
      {createElement(icon, { size: 15 })}
      {children}
    </button>
  );
}

// ─── Customer picker ─────────────────────────────────────────────────────────

function CustomerPicker({ users, loading, onSelect }) {
  const [search, setSearch] = useState('');

  const filtered = users.filter((u) => matchesSearch(search, [u.name, u.phone, formatAddress(u.address)]));

  return (
    <div className="space-y-3">
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Search customer by name, phone or address..."
        className="max-w-lg"
      />

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-slate-50" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <User size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No customers found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.slice(0, 60).map((user) => {
            const disabled = !user.is_profile_complete || user.deletion_requested;
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => onSelect(user.id)}
                className="card p-3.5 text-left hover:ring-2 hover:ring-blue-200 transition-shadow flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-sm font-bold">{user.name ? user.name[0].toUpperCase() : '?'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 text-sm truncate">
                    {user.name || <span className="text-slate-400 italic font-normal">Incomplete profile</span>}
                  </p>
                  <p className="text-xs text-slate-500">{user.phone || '—'}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {user.subscription ? (
                      <span className={STATUS_BADGE[user.subscription.status] || 'badge badge-gray'}>
                        {user.subscription.quantity_litres}L {MILK_LABELS[user.subscription.milk_type] || user.subscription.milk_type} · {user.subscription.status}
                      </span>
                    ) : (
                      <span className="badge badge-gray">no subscription</span>
                    )}
                    {disabled && <span className="badge badge-red">{user.deletion_requested ? 'deletion requested' : 'profile incomplete'}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {filtered.length > 60 && (
        <p className="text-xs text-slate-400">Showing 60 of {filtered.length} — refine your search.</p>
      )}
    </div>
  );
}

// ─── Customer header ─────────────────────────────────────────────────────────

function CustomerHeader({ overview, onChange }) {
  const { customer, schedule, due } = overview;
  const address = formatAddress(customer.address);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
            <span className="text-white font-bold">{customer.name ? customer.name[0].toUpperCase() : '?'}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">{customer.name || 'Unnamed customer'}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 mt-0.5">
              {customer.phone && <span className="flex items-center gap-1"><Phone size={11} />{customer.phone}</span>}
              {address && <span className="flex items-center gap-1 max-w-md truncate"><MapPin size={11} />{address}</span>}
            </div>
          </div>
        </div>
        <button type="button" onClick={onChange} className="btn-secondary btn-sm">
          <ArrowLeftRight size={13} /> Change customer
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100">
        <HeaderStat icon={CalendarClock} label="Next open delivery">
          {formatDate(schedule.target_date)}
        </HeaderStat>
        <HeaderStat icon={Lock} label="Cutoff">
          {schedule.cutoff_time} {schedule.is_past_cutoff && <span className="text-amber-600">(passed today)</span>}
        </HeaderStat>
        <HeaderStat icon={Wallet} label="Outstanding due">
          <span className={due.due_amount > 0 ? 'text-red-600' : 'text-emerald-600'}>{rupees(due.due_amount)}</span>
        </HeaderStat>
        <HeaderStat icon={customer.push_enabled ? Bell : BellOff} label="Notifications">
          {customer.push_enabled
            ? <span className="text-emerald-600">Push + in-app</span>
            : <span className="text-amber-600" title="No device registered — they will see it next time they open the app">In-app only</span>}
        </HeaderStat>
      </div>
    </div>
  );
}

function HeaderStat({ icon, label, children }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-slate-400 mb-0.5">
        {createElement(icon, { size: 12 })}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-sm text-slate-700 font-medium">{children}</p>
    </div>
  );
}

// ─── Products ────────────────────────────────────────────────────────────────

function ProductsPanel({ overview, catalog, onSaved, onError }) {
  const { schedule, next_delivery: nextDelivery, upcoming_orders: upcomingOrders, customer } = overview;
  const targetDate = schedule.target_date;

  const [basket, setBasket] = useState({}); // product_id -> quantity
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyLine, setBusyLine] = useState(null);
  // One id per basket: a retry after a timeout reuses it, so the server
  // applies the order once even if the first attempt actually landed.
  const requestIdRef = useRef(newRequestId());

  const productsById = useMemo(
    () => new Map(catalog.products.map((p) => [p.id, p])),
    [catalog.products]
  );

  const bookedItems = nextDelivery?.extra_items || [];
  const bookedQty = new Map(bookedItems.map((item) => [item.product_id, item.quantity]));

  const visibleProducts = catalog.products.filter((p) =>
    (!category || p.category === category) && matchesSearch(search, [p.name, p.unit, p.category])
  );

  const basketLines = Object.entries(basket)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ product: productsById.get(id), quantity: qty }))
    .filter((line) => line.product);
  const basketTotal = basketLines.reduce((sum, l) => sum + l.quantity * l.product.price, 0);

  function setBasketQty(productId, qty) {
    const cap = MAX_UNITS - (bookedQty.get(productId) || 0);
    const next = Math.max(0, Math.min(cap, qty));
    setBasket((b) => ({ ...b, [productId]: next }));
  }

  async function placeOrder() {
    setSubmitting(true);
    try {
      const res = await api.post(`/admin-orders/customers/${customer.id}/products`, {
        items: basketLines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        expected_date: targetDate,
        note: note.trim() || undefined,
        request_id: requestIdRef.current,
      });
      setBasket({});
      setNote('');
      setConfirming(false);
      requestIdRef.current = newRequestId();
      await onSaved(res.data.data?.duplicate
        ? 'This order was already placed — nothing was added twice.'
        : `Order placed for ${formatDate(targetDate)} — ${customer.name || 'customer'} has been notified`);
    } catch (err) {
      setConfirming(false);
      await onError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function changeBookedQty(item, quantity) {
    setBusyLine(item.product_id);
    try {
      await api.put(`/admin-orders/customers/${customer.id}/products/${item.product_id}`, {
        quantity,
        expected_date: targetDate,
        request_id: newRequestId(),
      });
      await onSaved(quantity === 0
        ? `${item.product_name} removed — customer notified`
        : `${item.product_name} set to ${quantity} — customer notified`);
    } catch (err) {
      await onError(err);
    } finally {
      setBusyLine(null);
    }
  }

  // Deliveries already generated for an earlier date (e.g. tomorrow, once the
  // cutoff has passed) are on the manifest and are not editable from here.
  const committed = upcomingOrders.filter((o) => o.date !== targetDate);

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
      <div className="space-y-4 min-w-0">
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          <Info size={15} className="shrink-0 mt-0.5" />
          <span>
            Products are added to the customer&apos;s delivery on <strong>{formatDate(targetDate)}</strong> — the next date still open
            after the {schedule.cutoff_time} cutoff. It goes on that day&apos;s manifest and is billed only when marked delivered.
          </span>
        </div>

        {committed.length > 0 && (
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Lock size={12} /> Already on a manifest
            </p>
            {committed.map((order) => (
              <div key={order.id} className="text-sm text-slate-600 flex flex-wrap justify-between gap-2 py-1">
                <span>
                  {formatDate(order.date)} · {order.milk ? `${order.milk.quantity_litres}L ${MILK_LABELS[order.milk.milk_type] || order.milk.milk_type}` : 'No milk'}
                  {order.extra_items.length > 0 && ` · ${order.extra_items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ')}`}
                </span>
                <span className="font-semibold">{rupees(order.total_amount)}</span>
              </div>
            ))}
            <p className="text-xs text-slate-400 mt-1">Cancel or confirm these from the Orders page.</p>
          </div>
        )}

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700">Booked for {formatDate(targetDate)}</p>
            {nextDelivery?.effective_milk && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Milk size={12} /> {nextDelivery.effective_milk.quantity_litres}L {MILK_LABELS[nextDelivery.effective_milk.milk_type]} milk
              </span>
            )}
          </div>
          {bookedItems.length === 0 ? (
            <p className="text-sm text-slate-400">No extra products booked yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {bookedItems.map((item) => (
                <div key={item.product_id} className="flex items-center gap-3 py-2">
                  <Thumb src={productImage(productsById.get(item.product_id))} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.product_name}</p>
                    <p className="text-xs text-slate-400">
                      {item.unit} · {rupees(item.price)} each ·{' '}
                      {item.added_by_admin
                        ? <span className="text-violet-600">added by dairy</span>
                        : <span>added by customer</span>}
                    </p>
                  </div>
                  <Stepper
                    value={item.quantity}
                    busy={busyLine === item.product_id}
                    disabled={busyLine !== null}
                    max={MAX_UNITS}
                    onChange={(q) => changeBookedQty(item, q)}
                  />
                  <span className="text-sm font-semibold text-slate-700 w-16 text-right">{rupees(item.total)}</span>
                  <button
                    type="button"
                    disabled={busyLine !== null}
                    onClick={() => changeBookedQty(item, 0)}
                    className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                    aria-label={`Remove ${item.product_name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <SearchField value={search} onChange={setSearch} placeholder="Search products..." className="flex-1" />
            <select className="select sm:w-48" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {catalog.categories.map((c) => <option key={c.slug} value={c.slug}>{c.label || c.slug}</option>)}
            </select>
          </div>

          {catalog.products.length === 0 ? (
            <div className="card p-10 text-center text-sm text-slate-400">
              <Package size={32} className="mx-auto text-slate-300 mb-2" />
              No active products available for scheduled delivery.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {visibleProducts.map((product) => {
                const qty = basket[product.id] || 0;
                const already = bookedQty.get(product.id) || 0;
                return (
                  <div key={product.id} className={`card p-3 flex items-center gap-3 ${qty > 0 ? 'ring-2 ring-blue-200' : ''}`}>
                    <Thumb src={productImage(product)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
                      <p className="text-xs text-slate-400">{product.unit} · {rupees(product.price)}</p>
                      {already > 0 && <p className="text-[11px] text-violet-600">{already} already booked</p>}
                    </div>
                    {qty === 0 ? (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        disabled={already >= MAX_UNITS}
                        onClick={() => setBasketQty(product.id, 1)}
                      >
                        <Plus size={13} /> Add
                      </button>
                    ) : (
                      <Stepper value={qty} max={MAX_UNITS - already} onChange={(q) => setBasketQty(product.id, q)} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card p-4 lg:sticky lg:top-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><ShoppingBag size={15} /> New order</p>
        {basketLines.length === 0 ? (
          <p className="text-sm text-slate-400">Add products from the list to build the order.</p>
        ) : (
          <div className="space-y-1.5">
            {basketLines.map(({ product, quantity }) => (
              <div key={product.id} className="flex justify-between gap-2 text-sm">
                <span className="text-slate-600 truncate">{product.name} × {quantity}</span>
                <span className="text-slate-700 font-medium">{rupees(quantity * product.price)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-slate-100 text-sm font-semibold">
              <span>Total</span>
              <span>{rupees(basketTotal)}</span>
            </div>
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-slate-500" htmlFor="order-note">Note to customer (optional)</label>
          <textarea
            id="order-note"
            className="input mt-1 min-h-[64px]"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. As requested on the phone"
          />
        </div>
        <button
          type="button"
          className="btn-primary w-full justify-center disabled:opacity-50"
          disabled={basketLines.length === 0 || submitting}
          onClick={() => setConfirming(true)}
        >
          Place order for {formatDate(targetDate)}
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Place this order?"
          confirmLabel="Place order"
          busy={submitting}
          onCancel={() => setConfirming(false)}
          onConfirm={placeOrder}
        >
          <p>
            {basketLines.length} product{basketLines.length > 1 ? 's' : ''} worth <strong>{rupees(basketTotal)}</strong> will be
            added to <strong>{customer.name || 'the customer'}</strong>&apos;s delivery on <strong>{formatDate(targetDate)}</strong>.
          </p>
          <p className="mt-2">They will get a notification and see the items in their cart. They are billed only after delivery.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function Stepper({ value, onChange, max = MAX_UNITS, busy = false, disabled = false }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="btn-icon bg-slate-100 hover:bg-slate-200 text-slate-600 p-1 disabled:opacity-40"
        disabled={disabled || busy || value <= 0}
        onClick={() => onChange(value - 1)}
        aria-label="Decrease"
      >
        <Minus size={12} />
      </button>
      <span className="w-7 text-center text-sm font-semibold text-slate-700">
        {busy ? <Loader2 size={13} className="animate-spin inline" /> : value}
      </span>
      <button
        type="button"
        className="btn-icon bg-slate-100 hover:bg-slate-200 text-slate-600 p-1 disabled:opacity-40"
        disabled={disabled || busy || value >= max}
        onClick={() => onChange(value + 1)}
        aria-label="Increase"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

function Thumb({ src }) {
  return src ? (
    <img src={src} alt="" className="w-11 h-11 rounded-lg object-cover bg-slate-100 shrink-0" />
  ) : (
    <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
      <Package size={16} className="text-slate-300" />
    </div>
  );
}

// ─── Subscription ────────────────────────────────────────────────────────────

function SubscriptionPanel({ overview, onSaved, onError }) {
  const { subscription, schedule, customer } = overview;
  return (
    <div className="grid lg:grid-cols-2 gap-5 items-start">
      {/* Keyed on the saved values so the form resets to the server's state after every change. */}
      {subscription ? (
        <ManageSubscription
          key={`${subscription.id}-${subscription.status}-${subscription.quantity_litres}-${subscription.delivery_slot}`}
          overview={overview}
          onSaved={onSaved}
          onError={onError}
        />
      ) : (
        <CreateSubscription key={schedule.target_date} overview={overview} onSaved={onSaved} onError={onError} />
      )}

      <div className="space-y-4">
        {subscription && (
          <NextDeliveryCard
            key={`${overview.next_delivery?.date}-${overview.next_delivery?.override?.id || 'regular'}-${overview.next_delivery?.effective_milk?.quantity_litres ?? 'none'}`}
            overview={overview}
            onSaved={onSaved}
            onError={onError}
          />
        )}
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          <Info size={15} className="shrink-0 mt-0.5" />
          <span>
            Pause, resume and cancel apply from <strong>{formatDate(schedule.target_date)}</strong>. Quantity and slot changes are
            closed after the {schedule.cutoff_time} cutoff until midnight. {customer.name || 'The customer'} is notified of every change
            and sees it in the app straight away.
          </span>
        </div>
      </div>
    </div>
  );
}

function CreateSubscription({ overview, onSaved, onError }) {
  const { prices, schedule, customer } = overview;
  const [form, setForm] = useState({
    milk_type: prices[0]?.milk_type || 'cow',
    quantity_litres: 1,
    delivery_slot: 'morning',
    start_date: schedule.target_date,
  });
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const price = prices.find((p) => p.milk_type === form.milk_type)?.price_per_litre || 0;
  const daily = price * form.quantity_litres * (form.delivery_slot === 'both' ? 2 : 1);

  async function submit() {
    setSubmitting(true);
    try {
      await api.post(`/admin-orders/customers/${customer.id}/subscription`, form);
      setConfirming(false);
      await onSaved(`Subscription started from ${formatDate(form.start_date)} — customer notified`);
    } catch (err) {
      setConfirming(false);
      await onError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (prices.length === 0) {
    return <div className="card p-6 text-sm text-slate-500">No milk prices are configured. Set them on the Prices page first.</div>;
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <p className="font-semibold text-slate-800">Start a subscription</p>
        <p className="text-xs text-slate-400">This customer has no active or paused subscription.</p>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Milk type</p>
        <div className="grid grid-cols-3 gap-2">
          {prices.map((p) => (
            <button
              key={p.milk_type}
              type="button"
              onClick={() => setForm((f) => ({ ...f, milk_type: p.milk_type }))}
              className={`rounded-xl border px-3 py-2 text-left ${form.milk_type === p.milk_type ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}
            >
              <p className="text-sm font-semibold text-slate-700">{MILK_LABELS[p.milk_type] || p.milk_type}</p>
              <p className="text-xs text-slate-400">{rupees(p.price_per_litre)}/L</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Daily quantity</span>
          <select
            className="select mt-1"
            value={form.quantity_litres}
            onChange={(e) => setForm((f) => ({ ...f, quantity_litres: Number(e.target.value) }))}
          >
            {LITRE_OPTIONS.map((q) => <option key={q} value={q}>{q} L</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Slot</span>
          <select
            className="select mt-1"
            value={form.delivery_slot}
            onChange={(e) => setForm((f) => ({ ...f, delivery_slot: e.target.value }))}
          >
            {SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-slate-500">Start date</span>
        <input
          type="date"
          className="input mt-1"
          min={schedule.target_date}
          value={form.start_date}
          onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
        />
        <span className="text-[11px] text-slate-400">Earliest: {formatDate(schedule.target_date)}</span>
      </label>

      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-500">Estimated per day</span>
        <span className="font-semibold text-slate-800">{rupees(daily)}</span>
      </div>

      <button
        type="button"
        className="btn-primary w-full justify-center disabled:opacity-50"
        disabled={!form.start_date || form.start_date < schedule.target_date}
        onClick={() => setConfirming(true)}
      >
        Start subscription
      </button>

      {confirming && (
        <ConfirmDialog title="Start this subscription?" confirmLabel="Start subscription" busy={submitting} onCancel={() => setConfirming(false)} onConfirm={submit}>
          <p>
            <strong>{form.quantity_litres}L {MILK_LABELS[form.milk_type]}</strong> milk, {SLOT_LABELS[form.delivery_slot].toLowerCase()},
            from <strong>{formatDate(form.start_date)}</strong> at {rupees(price)}/L for {customer.name || 'the customer'}.
          </p>
          <p className="mt-2">The rate is locked in. The customer is notified and can pause or cancel from the app.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function ManageSubscription({ overview, onSaved, onError }) {
  const { subscription: sub, schedule, customer } = overview;
  const [quantity, setQuantity] = useState(sub.quantity_litres);
  const [slot, setSlot] = useState(sub.delivery_slot);
  const [pending, setPending] = useState(null); // { action, label, body, message }
  const [submitting, setSubmitting] = useState(false);

  const editsLocked = schedule.is_past_cutoff;
  const pausedFuture = sub.status === 'paused';

  async function run({ action, body = {}, message }) {
    setSubmitting(true);
    try {
      await api.put(`/admin-orders/customers/${customer.id}/subscription/${sub.id}`, { action, ...body });
      setPending(null);
      await onSaved(message);
    } catch (err) {
      setPending(null);
      await onError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function ask(action, title, description, message, body) {
    setPending({ action, title, description, message, body });
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800 flex items-center gap-2">
            <Milk size={16} className="text-blue-500" />
            {sub.quantity_litres}L {MILK_LABELS[sub.milk_type] || sub.milk_type} · {SLOT_LABELS[sub.delivery_slot]}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {rupees(sub.price_per_litre)}/L · started {formatDate(sub.start_date)}
            {sub.created_by?.type === 'admin' && ' · set up by dairy'}
          </p>
        </div>
        <span className={STATUS_BADGE[sub.status] || 'badge badge-gray'}>{sub.status}</span>
      </div>

      {pausedFuture && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          Paused from {formatDate(sub.effective_from)}. No milk is delivered until it is resumed.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <span className="text-xs font-medium text-slate-500">Daily quantity</span>
          <div className="flex gap-2 mt-1">
            <select className="select" value={quantity} disabled={editsLocked} onChange={(e) => setQuantity(Number(e.target.value))}>
              {LITRE_OPTIONS.map((q) => <option key={q} value={q}>{q} L</option>)}
            </select>
            <button
              type="button"
              className="btn-secondary btn-sm disabled:opacity-40"
              disabled={editsLocked || quantity === sub.quantity_litres}
              onClick={() => ask('quantity', 'Change daily quantity?', `From ${sub.quantity_litres}L to ${quantity}L for every regular delivery, starting with the next open one.`, `Daily quantity set to ${quantity}L — customer notified`, { quantity_litres: quantity })}
            >
              Save
            </button>
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-slate-500">Delivery slot</span>
          <div className="flex gap-2 mt-1">
            <select className="select" value={slot} disabled={editsLocked} onChange={(e) => setSlot(e.target.value)}>
              {SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}
            </select>
            <button
              type="button"
              className="btn-secondary btn-sm disabled:opacity-40"
              disabled={editsLocked || slot === sub.delivery_slot}
              onClick={() => ask('slot', 'Change delivery slot?', `Regular deliveries move to ${SLOT_LABELS[slot].toLowerCase()}.${slot === 'both' || sub.delivery_slot === 'both' ? ' This changes the daily amount billed.' : ''}`, `Slot changed to ${SLOT_LABELS[slot]} — customer notified`, { delivery_slot: slot })}
            >
              Save
            </button>
          </div>
        </div>
      </div>
      {editsLocked && (
        <p className="text-xs text-slate-400 flex items-center gap-1"><Lock size={11} /> Quantity and slot reopen at midnight (cutoff {schedule.cutoff_time} has passed).</p>
      )}

      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
        {sub.status === 'active' ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => ask('pause', 'Pause subscription?', `Regular deliveries stop from ${formatDate(schedule.target_date)} until resumed.`, 'Subscription paused — customer notified')}
          >
            <Pause size={14} /> Pause
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => ask('resume', 'Resume subscription?', `Regular deliveries restart from ${formatDate(schedule.target_date)}.`, 'Subscription resumed — customer notified')}
          >
            <Play size={14} /> Resume
          </button>
        )}
        <button
          type="button"
          className="btn-danger"
          onClick={() => ask('cancel', 'Cancel subscription?', `This permanently ends the subscription. No regular deliveries from ${formatDate(schedule.target_date)}. A new one can be started afterwards.`, 'Subscription cancelled — customer notified')}
        >
          <XCircle size={14} /> Cancel subscription
        </button>
      </div>

      {pending && (
        <ConfirmDialog
          title={pending.title}
          confirmLabel="Confirm"
          danger={pending.action === 'cancel'}
          busy={submitting}
          onCancel={() => setPending(null)}
          onConfirm={() => run(pending)}
        >
          <p>{pending.description}</p>
          <p className="mt-2">{customer.name || 'The customer'} will be notified.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function NextDeliveryCard({ overview, onSaved, onError }) {
  const { next_delivery: next, schedule, subscription: sub, customer } = overview;
  const [quantity, setQuantity] = useState(next?.effective_milk?.quantity_litres || sub.quantity_litres);
  const [submitting, setSubmitting] = useState(null);

  const deliverable = !!next?.subscription;

  async function run(action, body = {}) {
    setSubmitting(action);
    try {
      await api.post(`/admin-orders/customers/${customer.id}/next-delivery`, {
        action,
        expected_date: schedule.target_date,
        ...body,
      });
      const messages = {
        skip: `Delivery on ${formatDate(schedule.target_date)} skipped — customer notified`,
        modify: `${formatDate(schedule.target_date)} set to ${body.quantity_litres}L — customer notified`,
        revert: `${formatDate(schedule.target_date)} back to regular — customer notified`,
      };
      await onSaved(messages[action]);
    } catch (err) {
      await onError(err);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="card p-5 space-y-3">
      <div>
        <p className="font-semibold text-slate-800">Only {formatDate(schedule.target_date)}</p>
        <p className="text-xs text-slate-400">Change one day&apos;s milk without touching the subscription.</p>
      </div>

      {!deliverable ? (
        <p className="text-sm text-slate-500">No milk is scheduled for this date (the subscription is paused or starts later).</p>
      ) : (
        <>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm flex justify-between">
            <span className="text-slate-500">Scheduled</span>
            <span className="font-semibold text-slate-800">
              {next.is_skipped
                ? 'Skipped'
                : `${next.effective_milk.quantity_litres}L${next.override ? ` (usually ${sub.quantity_litres}L)` : ''}`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="select w-28" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} aria-label="Quantity for this day">
              {LITRE_OPTIONS.map((q) => <option key={q} value={q}>{q} L</option>)}
            </select>
            <button
              type="button"
              className="btn-secondary"
              disabled={submitting !== null || (!next.is_skipped && next.effective_milk?.quantity_litres === quantity)}
              onClick={() => run('modify', { quantity_litres: quantity })}
            >
              {submitting === 'modify' ? <Loader2 size={14} className="animate-spin" /> : <Milk size={14} />} Set for this day
            </button>
            {!next.is_skipped && (
              <button type="button" className="btn-secondary" disabled={submitting !== null} onClick={() => run('skip')}>
                {submitting === 'skip' ? <Loader2 size={14} className="animate-spin" /> : <SkipForward size={14} />} Skip
              </button>
            )}
            {next.override && (
              <button type="button" className="btn-ghost" disabled={submitting !== null} onClick={() => run('revert')}>
                {submitting === 'revert' ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Back to regular
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────

function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel, busy, danger = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in p-5">
        <p className="font-semibold text-slate-800">{title}</p>
        <div className="text-sm text-slate-600 mt-2">{children}</div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Back</button>
          <button type="button" className={`${danger ? 'btn-danger' : 'btn-primary'} disabled:opacity-60`} disabled={busy} onClick={onConfirm}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
