import { createElement, useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import LocationModal from '../components/LocationModal';
import LocationLink from '../components/LocationLink';
import { SubscriptionPanel, ConfirmDialog } from './PlaceOrderPage';
import { DeliveryCalendarModal } from './UsersPage';
import {
  ArrowLeft, User, Phone, MapPin, Wallet, Repeat, Zap, Truck, Loader2, AlertTriangle,
  CheckCircle2, ShieldAlert, Trash2, Plus, Minus, Bell, BellOff, CalendarDays, ShoppingBag,
  RotateCcw, Ban, Check, X, Save, Send, PhoneCall, Lock, IndianRupee, Info,
} from 'lucide-react';

// ─── Labels ──────────────────────────────────────────────────────────────────

const MILK_LABELS = { cow: 'Cow', buffalo: 'Buffalo', toned: 'Child Pack' };
const SLOT_LABELS = { morning: 'Morning', evening: 'Evening', both: 'Morning + Evening' };
const METHOD_LABELS = { cash: 'Cash', upi: 'UPI', other: 'Other' };

const CATEGORY_LABELS = {
  previous_balance: 'Previous balance',
  subscription: 'Milk subscription',
  products: 'Products',
  instant_order: 'Instant order (unpaid cash)',
  delivery_charge: 'Delivery charges',
  late_fee: 'Late fee',
  discount: 'Discount',
  correction: 'Correction',
  other: 'Other',
};
const CHARGE_CATEGORIES = ['previous_balance', 'subscription', 'products', 'instant_order', 'delivery_charge', 'late_fee', 'correction', 'other'];
const CREDIT_CATEGORIES = ['discount', 'correction', 'subscription', 'products', 'delivery_charge', 'other'];

const SUB_STATUS_BADGE = { active: 'badge badge-green', paused: 'badge badge-yellow', cancelled: 'badge badge-gray' };

const INSTANT_STATUS = {
  pending: { label: 'Requested', badge: 'badge badge-yellow' },
  acknowledged: { label: 'Accepted', badge: 'badge badge-blue' },
  delivered: { label: 'Delivered', badge: 'badge badge-green' },
  rejected: { label: 'Rejected', badge: 'badge badge-red' },
  cancelled: { label: 'Cancelled', badge: 'badge badge-gray' },
};

const ORDER_STATUS = {
  pending: { label: 'Pending', badge: 'badge badge-yellow' },
  delivered: { label: 'Delivered', badge: 'badge badge-green' },
  not_delivered: { label: 'Not delivered', badge: 'badge badge-red' },
  cancelled: { label: 'Cancelled', badge: 'badge badge-gray' },
  skipped: { label: 'Skipped', badge: 'badge badge-gray' },
};

const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'dues', label: 'Dues & payments', icon: Wallet },
  { key: 'subscription', label: 'Subscription', icon: Repeat },
  { key: 'instant', label: 'Instant orders', icon: Zap },
  { key: 'deliveries', label: 'Deliveries', icon: Truck },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function rupees(value) {
  const n = Number(value) || 0;
  const sign = n < 0 ? '−' : '';
  return `${sign}₹${Math.abs(n).toFixed(2).replace(/\.00$/, '')}`;
}

function formatDate(isoDate, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!isoDate || typeof isoDate !== 'string') return '—';
  const date = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00` : isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-IN', opts);
}

function formatDateTime(iso) {
  if (!iso || typeof iso !== 'string') return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function formatAddress(address) {
  if (!address) return null;
  if (typeof address === 'string') return address;
  return [address.line1, address.line2, address.landmark, address.pincode].filter(Boolean).join(', ');
}

function describeMilk(milk) {
  if (!milk) return null;
  return `${milk.quantity_litres}L ${MILK_LABELS[milk.milk_type] || milk.milk_type}`;
}

/**
 * The user page reads two things: the account (profile, ledger, orders) and
 * the "Order for customer" overview the subscription manager is built on. A
 * failed overview only disables the Subscription tab.
 */
async function fetchCustomer(userId) {
  const [detailRes, overviewRes] = await Promise.allSettled([
    api.get(`/users/admin/${userId}`),
    api.get(`/admin-orders/customers/${userId}`),
  ]);
  if (detailRes.status === 'rejected') {
    return { userId, failed: true, error: errorMessage(detailRes.reason, 'Failed to load customer') };
  }
  return {
    userId,
    detail: detailRes.value.data.data,
    overview: overviewRes.status === 'fulfilled' ? overviewRes.value.data.data : null,
    overviewError: overviewRes.status === 'rejected' ? errorMessage(overviewRes.reason, 'Failed to load subscription') : '',
    error: '',
  };
}

// A failed refresh keeps what is already on screen for the same customer.
function mergeCustomerState(prev, next) {
  if (next.failed) {
    return prev.userId === next.userId ? { ...prev, error: next.error } : { userId: next.userId, detail: null, overview: null, overviewError: '', error: next.error };
  }
  return next;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : 'profile';

  // Results are stored with the user they belong to, so navigating to another
  // customer never shows the previous one's data while the new one loads.
  const [state, setState] = useState({ userId: null, detail: null, overview: null, overviewError: '', error: '' });
  const [toast, setToast] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const toastTimer = useRef(null);

  const refresh = useCallback(async () => {
    const next = await fetchCustomer(userId);
    setState((prev) => mergeCustomerState(prev, next));
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    fetchCustomer(userId).then((next) => {
      if (!cancelled) setState((prev) => mergeCustomerState(prev, next));
    });
    return () => { cancelled = true; };
  }, [userId]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((message, tone = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const onSaved = useCallback(async (message) => {
    await refresh();
    if (message) showToast(message);
  }, [refresh, showToast]);

  const onError = useCallback(async (err) => {
    if (isDateChanged(err)) {
      await refresh();
      showToast('The cutoff passed while this page was open, so the next open delivery date has moved. Nothing was saved — review and try again.', 'error');
      return;
    }
    showToast(errorMessage(err), 'error');
  }, [refresh, showToast]);

  const current = state.userId === userId ? state : null;
  const detail = current?.detail?.user?.id === userId ? current.detail : null;
  const loadError = current?.error || '';

  function setTab(key) {
    setSearchParams(key === 'profile' ? {} : { tab: key }, { replace: true });
  }

  return (
    <div className="space-y-4">
      <Link to="/users" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600">
        <ArrowLeft size={15} /> All users
      </Link>

      {!detail && !loadError && (
        <div className="card p-10 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading customer...</span>
        </div>
      )}

      {loadError && !detail && (
        <div className="card p-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border-red-100">
          <AlertTriangle size={15} /> {loadError}
        </div>
      )}

      {detail && (
        <>
          <UserHeader
            detail={detail}
            onCalendar={() => setCalendarOpen(true)}
            onLocation={() => setLocationOpen(true)}
          />

          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`btn shrink-0 ${tab === t.key ? 'btn-primary' : 'bg-white border border-slate-200 text-slate-600'}`}
              >
                {createElement(t.icon, { size: 15 })}
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'profile' && (
            <ProfileTab
              key={detail.user.updated_at || detail.user.id}
              detail={detail}
              onSaved={onSaved}
              onError={onError}
              onDeleted={() => navigate('/users', { replace: true })}
            />
          )}
          {tab === 'dues' && <DuesTab detail={detail} onSaved={onSaved} onError={onError} />}
          {tab === 'subscription' && (
            <SubscriptionTab
              detail={detail}
              overview={current.overview}
              overviewError={current.overviewError}
              onSaved={onSaved}
              onError={onError}
            />
          )}
          {tab === 'instant' && <InstantTab detail={detail} onSaved={onSaved} onError={onError} />}
          {tab === 'deliveries' && (
            <DeliveriesTab detail={detail} onSaved={onSaved} onError={onError} onCalendar={() => setCalendarOpen(true)} />
          )}
        </>
      )}

      {calendarOpen && detail && (
        <DeliveryCalendarModal user={detail.user} onClose={() => setCalendarOpen(false)} />
      )}
      {locationOpen && detail && (
        <LocationModal
          user={detail.user}
          onClose={() => setLocationOpen(false)}
          onLocationUpdated={() => refresh()}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm flex items-start gap-2 rounded-xl px-4 py-3 shadow-lg text-sm animate-slide-in ${
            toast.tone === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
          }`}
        >
          {toast.tone === 'error'
            ? <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            : <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function UserHeader({ detail, onCalendar, onLocation }) {
  const { user, due } = detail;
  const liveSub = detail.subscriptions.find((s) => s.status === 'active' || s.status === 'paused');
  const address = formatAddress(user.address);
  const canOrder = user.is_profile_complete && !user.deletion_requested;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-bold">{user.name ? user.name[0].toUpperCase() : '?'}</span>
          </div>
          <div className="min-w-0">
            <h2 className="page-title leading-tight">{user.name || <span className="text-slate-400 italic font-normal">Incomplete profile</span>}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 mt-1">
              {user.phone && <span className="flex items-center gap-1"><Phone size={11} />{user.phone}</span>}
              {address && <span className="flex items-center gap-1 max-w-md truncate"><MapPin size={11} />{address}</span>}
              {user.location && <LocationLink location={user.location} className="text-xs" size={11} />}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {liveSub
                ? <span className={SUB_STATUS_BADGE[liveSub.status]}>{liveSub.quantity_litres}L {MILK_LABELS[liveSub.milk_type] || liveSub.milk_type} · {liveSub.status}</span>
                : <span className="badge badge-gray">no subscription</span>}
              <span className={user.call_in_enabled ? 'badge badge-blue' : 'badge badge-gray'}>Call in: {user.call_in_enabled ? 'On' : 'Off'}</span>
              {user.instant_orders_blocked && <span className="badge badge-red">Instant orders off</span>}
              {user.deletion_requested && <span className="badge badge-red">Deletion requested</span>}
              {!user.is_profile_complete && <span className="badge badge-yellow">Profile incomplete</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canOrder && (
            <Link to={`/place-order?user=${user.id}`} className="btn-secondary btn-sm">
              <ShoppingBag size={13} /> Order for customer
            </Link>
          )}
          <button type="button" onClick={onCalendar} className="btn-secondary btn-sm">
            <CalendarDays size={13} /> Calendar
          </button>
          <button type="button" onClick={onLocation} className="btn-secondary btn-sm">
            <MapPin size={13} /> Location
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4 pt-3 border-t border-slate-100">
        <Stat label="Outstanding due">
          <span className={due.due_amount > 0 ? 'text-red-600' : 'text-emerald-600'}>{rupees(due.due_amount)}</span>
        </Stat>
        <Stat label="Total billed">{rupees(due.total_billed)}</Stat>
        <Stat label="Total paid">{rupees(due.total_paid)}</Stat>
        <Stat label="Area">{user.area_name || '—'}</Stat>
        <Stat label="Notifications">
          {user.push_enabled
            ? <span className="inline-flex items-center gap-1 text-emerald-600"><Bell size={12} />Push + in-app</span>
            : <span className="inline-flex items-center gap-1 text-amber-600" title="No device registered — they see notifications next time they open the app"><BellOff size={12} />In-app only</span>}
        </Stat>
      </div>
    </div>
  );
}

function Stat({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-700 font-semibold">{children}</p>
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-3">
      <p className="font-semibold text-slate-800">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function Spinner() {
  return <Loader2 size={14} className="animate-spin" />;
}

/**
 * Confirm dialog with one text input (a reason, a note).
 */
function PromptDialog({ title, label, placeholder, confirmLabel, required = false, danger = false, busy, onConfirm, onCancel, children }) {
  const [value, setValue] = useState('');
  const ready = !required || value.trim().length > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
      <form
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in p-5"
        onSubmit={(e) => { e.preventDefault(); if (ready && !busy) onConfirm(value.trim()); }}
      >
        <p className="font-semibold text-slate-800">{title}</p>
        {children && <div className="text-sm text-slate-600 mt-2">{children}</div>}
        <label className="block mt-3">
          <span className="text-xs font-medium text-slate-500">{label}{required ? '' : ' (optional)'}</span>
          <textarea
            className="input mt-1 min-h-[72px]"
            maxLength={200}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </label>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Back</button>
          <button type="submit" className={`${danger ? 'btn-danger' : 'btn-primary'} disabled:opacity-60`} disabled={busy || !ready}>
            {busy && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Profile ─────────────────────────────────────────────────────────────────

function ProfileTab({ detail, onSaved, onError, onDeleted }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <ProfileForm user={detail.user} onSaved={onSaved} onError={onError} />
      <div className="space-y-4">
        <AccountSettings detail={detail} onSaved={onSaved} onError={onError} />
        <DangerZone user={detail.user} onDeleted={onDeleted} onError={onError} />
      </div>
    </div>
  );
}

const ADDRESS_KEYS = ['line1', 'line2', 'landmark', 'pincode'];

function ProfileForm({ user, onSaved, onError }) {
  const [form, setForm] = useState(() => ({
    name: user.name || '',
    phone: user.phone || '',
    ...Object.fromEntries(ADDRESS_KEYS.map((k) => [k, user.address?.[k] || ''])),
  }));
  const [saving, setSaving] = useState(false);

  const body = {};
  if (form.name.trim() !== (user.name || '')) body.name = form.name;
  if (form.phone.trim() !== (user.phone || '')) body.phone = form.phone;
  if (ADDRESS_KEYS.some((k) => form[k].trim() !== (user.address?.[k] || ''))) {
    body.address = Object.fromEntries(ADDRESS_KEYS.map((k) => [k, form[k]]));
  }
  const dirty = Object.keys(body).length > 0;

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function save(e) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    try {
      await api.patch(`/users/admin/${user.id}`, body);
      await onSaved('Customer details saved');
    } catch (err) {
      await onError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card p-5 space-y-3">
      <SectionTitle title="Customer details" subtitle="Shown to delivery staff and on the manifest. The customer sees the changes in their app." />
      <Field label="Name">
        <input className="input" value={form.name} onChange={set('name')} maxLength={80} required />
      </Field>
      <Field label="Phone" hint="Contact number. Sign-in still uses the number the customer verified in the app.">
        <input className="input" value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="+91XXXXXXXXXX" />
      </Field>
      <Field label="Address line 1">
        <input className="input" value={form.line1} onChange={set('line1')} maxLength={200} required />
      </Field>
      <Field label="Address line 2">
        <input className="input" value={form.line2} onChange={set('line2')} maxLength={200} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Landmark">
          <input className="input" value={form.landmark} onChange={set('landmark')} maxLength={200} />
        </Field>
        <Field label="Pincode">
          <input className="input" value={form.pincode} onChange={set('pincode')} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
        <button type="submit" className="btn-primary disabled:opacity-50" disabled={!dirty || saving}>
          {saving ? <Spinner /> : <Save size={14} />} Save details
        </button>
      </div>
    </form>
  );
}

function AccountSettings({ detail, onSaved, onError }) {
  const { user } = detail;
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'clear_deletion' | 'area'
  const [areaId, setAreaId] = useState(user.area_id || '');

  async function patch(key, body, message) {
    setBusy(key);
    try {
      await api.patch(`/users/admin/${user.id}`, body);
      setConfirm(null);
      await onSaved(message);
    } catch (err) {
      setConfirm(null);
      await onError(err);
    } finally {
      setBusy(null);
    }
  }

  const targetArea = detail.areas?.find((a) => a.id === areaId);

  return (
    <div className="card p-5 space-y-4">
      <SectionTitle title="Account settings" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><PhoneCall size={14} className="text-slate-400" /> Call in</p>
          <p className="text-xs text-slate-400 mt-0.5">The customer&apos;s &quot;Call In&quot; preference from the app.</p>
        </div>
        <button
          type="button"
          className={`btn-sm ${user.call_in_enabled ? 'btn-secondary' : 'btn-primary'}`}
          disabled={busy !== null}
          onClick={() => patch('call_in', { call_in_enabled: !user.call_in_enabled }, `Call in turned ${user.call_in_enabled ? 'off' : 'on'}`)}
        >
          {busy === 'call_in' && <Spinner />}
          {user.call_in_enabled ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      {user.deletion_requested && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 flex items-start gap-2.5">
          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Account deletion requested</p>
            <p className="text-xs mt-0.5">
              {user.deletion_requested_at ? `Requested ${formatDateTime(user.deletion_requested_at)}. ` : ''}
              Ordering is disabled until the request is cleared. Clear it if the customer changed their mind, or delete the account below.
            </p>
          </div>
          <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => setConfirm('clear_deletion')}>
            Clear request
          </button>
        </div>
      )}

      {detail.can_change_area && detail.areas && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> Area</p>
          <p className="text-xs text-slate-400 mt-0.5 mb-2">Super admin only. Allowed once nothing is scheduled for the customer in their current area.</p>
          <div className="flex gap-2">
            <select className="select" value={areaId} onChange={(e) => setAreaId(e.target.value)} aria-label="Area">
              {detail.areas.map((a) => (
                <option key={a.id} value={a.id} disabled={!a.is_active && a.id !== user.area_id}>
                  {a.name}{a.is_active ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary btn-sm disabled:opacity-40"
              disabled={!areaId || areaId === user.area_id}
              onClick={() => setConfirm('area')}
            >
              Move
            </button>
          </div>
        </div>
      )}

      {confirm === 'clear_deletion' && (
        <ConfirmDialog
          title="Clear the deletion request?"
          confirmLabel="Clear request"
          busy={busy !== null}
          onCancel={() => setConfirm(null)}
          onConfirm={() => patch('deletion', { deletion_requested: false }, 'Deletion request cleared')}
        >
          <p>The account stays, and ordering is enabled again for {user.name || 'this customer'}.</p>
        </ConfirmDialog>
      )}
      {confirm === 'area' && (
        <ConfirmDialog
          title="Move to another area?"
          confirmLabel="Move customer"
          busy={busy !== null}
          onCancel={() => setConfirm(null)}
          onConfirm={() => patch('area', { area_id: areaId }, `Moved to ${targetArea?.name || 'the new area'}`)}
        >
          <p>
            {user.name || 'This customer'} moves from <strong>{user.area_name || 'their area'}</strong> to <strong>{targetArea?.name}</strong>.
            Their balance moves with them, and the {targetArea?.name} admins take over their deliveries.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function DangerZone({ user, onDeleted, onError }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await api.delete(`/users/admin/${user.id}`);
      onDeleted();
    } catch (err) {
      setConfirming(false);
      setDeleting(false);
      await onError(err);
    }
  }

  return (
    <div className="card p-5 border border-red-100">
      <SectionTitle title="Delete customer" subtitle="Removes the profile, subscriptions, cart, orders, dues, payments, tickets and notifications. This cannot be undone." />
      <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>
        <Trash2 size={14} /> Delete permanently
      </button>
      {confirming && (
        <ConfirmDialog
          title="Delete this customer permanently?"
          confirmLabel="Delete customer"
          danger
          busy={deleting}
          onCancel={() => setConfirming(false)}
          onConfirm={remove}
        >
          <p>
            <strong>{user.name || user.phone || 'This customer'}</strong> and all of their records are removed. They will need to sign up again.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

// ─── Dues & payments ─────────────────────────────────────────────────────────

function DuesTab({ detail, onSaved, onError }) {
  const { user, due } = detail;
  const [mode, setMode] = useState(null); // 'charge' | 'credit' | 'payment'
  const [voidTarget, setVoidTarget] = useState(null);
  const [voiding, setVoiding] = useState(false);
  const [reminding, setReminding] = useState(false);

  const ledger = [
    ...detail.payments.map((p) => ({
      id: `pay-${p.id}`,
      kind: 'payment',
      date: p.payment_date,
      createdAt: p.created_at,
      label: `Payment · ${METHOD_LABELS[p.method] || p.method}`,
      note: p.notes,
      by: null,
      amount: -p.amount,
    })),
    ...detail.adjustments.map((a) => ({
      id: `adj-${a.id}`,
      adjustment: a,
      kind: a.type,
      date: a.date,
      createdAt: a.created_at,
      label: `${a.type === 'charge' ? 'Added' : 'Reduced'} · ${CATEGORY_LABELS[a.category] || a.category}`,
      note: a.note,
      by: a.created_by?.username,
      amount: a.type === 'charge' ? a.amount : -a.amount,
      voided: a.voided,
    })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

  async function sendReminder() {
    setReminding(true);
    try {
      await api.post(`/dues/admin/ping/${user.id}`);
      await onSaved('Payment reminder sent');
    } catch (err) {
      await onError(err);
    } finally {
      setReminding(false);
    }
  }

  async function voidAdjustment(reason) {
    setVoiding(true);
    try {
      await api.post(`/dues/admin/adjustment/${voidTarget.id}/void`, { reason });
      setVoidTarget(null);
      await onSaved('Adjustment reversed — customer notified');
    } catch (err) {
      setVoidTarget(null);
      await onError(err);
    } finally {
      setVoiding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Outstanding due" value={rupees(due.due_amount)} tone={due.due_amount > 0 ? 'text-red-600' : 'text-emerald-600'} />
        <SummaryCard label="Total billed" value={rupees(due.total_billed)} />
        <SummaryCard label="Total paid" value={rupees(due.total_paid)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={mode === 'charge' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode(mode === 'charge' ? null : 'charge')}>
          <Plus size={14} /> Add due
        </button>
        <button type="button" className={mode === 'credit' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode(mode === 'credit' ? null : 'credit')}>
          <Minus size={14} /> Reduce due
        </button>
        <button type="button" className={mode === 'payment' ? 'btn-primary' : 'btn-secondary'} onClick={() => setMode(mode === 'payment' ? null : 'payment')}>
          <IndianRupee size={14} /> Record payment
        </button>
        {due.due_amount > 0 && (
          <button type="button" className="btn-ghost" disabled={reminding} onClick={sendReminder}>
            {reminding ? <Spinner /> : <Send size={14} />} Send reminder
          </button>
        )}
      </div>

      {(mode === 'charge' || mode === 'credit') && (
        <AdjustmentForm
          key={mode}
          type={mode}
          detail={detail}
          onCancel={() => setMode(null)}
          onSaved={async (message) => { setMode(null); await onSaved(message); }}
          onError={onError}
        />
      )}
      {mode === 'payment' && (
        <PaymentForm
          detail={detail}
          onCancel={() => setMode(null)}
          onSaved={async (message) => { setMode(null); await onSaved(message); }}
          onError={onError}
        />
      )}

      <div className="card overflow-x-auto">
        <div className="px-4 pt-4">
          <SectionTitle title="Ledger" subtitle="Payments and manual changes. Delivered orders are billed automatically and appear in the Deliveries tab." />
        </div>
        {ledger.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-slate-400">No payments or manual changes yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Entry</th>
                <th>Note</th>
                <th>By</th>
                <th className="text-right">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) => (
                <tr key={row.id} className={row.voided ? 'opacity-50' : ''}>
                  <td className="whitespace-nowrap text-slate-600">{formatDate(row.date)}</td>
                  <td className="whitespace-nowrap">
                    <span className={row.voided ? 'line-through' : ''}>{row.label}</span>
                    {row.voided && <span className="badge badge-gray ml-2">reversed</span>}
                  </td>
                  <td className="text-slate-500 max-w-[240px]">
                    <span className="block truncate" title={row.note || ''}>{row.note || '—'}</span>
                    {row.voided && row.adjustment?.void_reason && (
                      <span className="block text-[11px] text-slate-400 truncate">Reversed: {row.adjustment.void_reason}</span>
                    )}
                  </td>
                  <td className="text-slate-500 whitespace-nowrap">{row.by || '—'}</td>
                  <td className={`text-right font-semibold whitespace-nowrap ${row.amount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {row.amount > 0 ? '+' : ''}{rupees(row.amount)}
                  </td>
                  <td className="text-right">
                    {row.adjustment && !row.voided && (
                      <button
                        type="button"
                        className="btn-icon text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Reverse this change"
                        aria-label="Reverse this change"
                        onClick={() => setVoidTarget(row.adjustment)}
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {voidTarget && (
        <PromptDialog
          title="Reverse this change?"
          label="Reason"
          placeholder="e.g. Entered the wrong amount"
          confirmLabel="Reverse"
          danger
          busy={voiding}
          onCancel={() => setVoidTarget(null)}
          onConfirm={voidAdjustment}
        >
          <p>
            The {voidTarget.type === 'charge' ? 'added' : 'reduced'} amount of <strong>{rupees(voidTarget.amount)}</strong> is undone, so the
            due {voidTarget.type === 'charge' ? 'goes down' : 'goes up'} by the same amount. The entry stays in the ledger marked as reversed,
            and the customer is notified.
          </p>
        </PromptDialog>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone = 'text-slate-800' }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

function AdjustmentForm({ type, detail, onCancel, onSaved, onError }) {
  const isCharge = type === 'charge';
  const categories = isCharge ? CHARGE_CATEGORIES : CREDIT_CATEGORIES;
  const [form, setForm] = useState({
    amount: '',
    category: categories[0],
    date: detail.today,
    note: '',
    notify: true,
  });
  const [submitting, setSubmitting] = useState(false);
  // One id per form, so a double submit or a retried request is applied once.
  const [requestId] = useState(newRequestId);

  const amount = Number(form.amount);
  const valid = form.amount !== '' && Number.isFinite(amount) && amount > 0 && amount <= 100000;
  const newDue = detail.due.due_amount + (isCharge ? amount : -amount);

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    try {
      const res = await api.post('/dues/admin/adjustment', {
        user_id: detail.user.id,
        type,
        amount: Math.round(amount * 100) / 100,
        category: form.category,
        date: form.date,
        note: form.note.trim() || null,
        notify: form.notify,
        request_id: requestId,
      });
      await onSaved(res.data.data?.duplicate
        ? 'This change was already recorded — the ledger shows the saved amount'
        : `${rupees(amount)} ${isCharge ? 'added to' : 'reduced from'} the due${form.notify ? ' — customer notified' : ''}`);
    } catch (err) {
      await onError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      <SectionTitle
        title={isCharge ? 'Add to due' : 'Reduce due'}
        subtitle={isCharge
          ? 'For money the customer owes that no delivery billed: an old balance, an unpaid cash order, a fee.'
          : 'For a discount, waiver or correction. To record money received, use Record payment instead.'}
      />
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Amount (₹)">
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min="0.01"
            max="100000"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            required
            autoFocus
          />
        </Field>
        <Field label="Reason">
          <select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
        </Field>
      </div>
      <Field label="Note (optional)" hint="Shown to the customer in the notification when given.">
        <input
          className="input"
          maxLength={200}
          value={form.note}
          placeholder={isCharge ? 'e.g. Balance from March before the app' : 'e.g. Milk was sour on 12 May'}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={form.notify} onChange={(e) => setForm((f) => ({ ...f, notify: e.target.checked }))} />
        Notify the customer
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-500">Due after this change</span>
        <span className="font-semibold text-slate-800">
          {rupees(detail.due.due_amount)} → {valid ? rupees(newDue) : '—'}
        </span>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button type="submit" className={`${isCharge ? 'btn-danger' : 'btn-primary'} disabled:opacity-50`} disabled={!valid || submitting}>
          {submitting ? <Spinner /> : isCharge ? <Plus size={14} /> : <Minus size={14} />}
          {isCharge ? 'Add to due' : 'Reduce due'}
        </button>
      </div>
    </form>
  );
}

function PaymentForm({ detail, onCancel, onSaved, onError }) {
  const [form, setForm] = useState({ amount: '', method: 'cash', date: detail.today, notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const amount = Number(form.amount);
  const valid = form.amount !== '' && Number.isFinite(amount) && amount > 0;

  async function submit(e) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    try {
      await api.post('/dues/admin/payment', {
        user_id: detail.user.id,
        amount: Math.round(amount * 100) / 100,
        method: form.method,
        payment_date: form.date,
        notes: form.notes.trim() || null,
      });
      await onSaved(`Payment of ${rupees(amount)} recorded — customer notified`);
    } catch (err) {
      await onError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      <SectionTitle title="Record payment" subtitle="Money received from the customer. Reduces the due and is counted in total paid." />
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Amount (₹)">
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            required
            autoFocus
          />
        </Field>
        <Field label="Method">
          <select className="select" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
            {Object.entries(METHOD_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={form.date} max={detail.today} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <input className="input" maxLength={200} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button type="submit" className="btn-primary disabled:opacity-50" disabled={!valid || submitting}>
          {submitting ? <Spinner /> : <Check size={14} />} Record payment
        </button>
      </div>
    </form>
  );
}

// ─── Subscription ────────────────────────────────────────────────────────────

function SubscriptionTab({ detail, overview, overviewError, onSaved, onError }) {
  const writable = detail.user.is_profile_complete && !detail.user.deletion_requested;
  const history = detail.subscriptions;

  return (
    <div className="space-y-4">
      {overviewError && (
        <div className="card p-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border-red-100">
          <AlertTriangle size={15} /> {overviewError}
        </div>
      )}

      {!writable ? (
        <div className="card p-5 text-sm text-slate-600 flex items-start gap-2.5">
          <Lock size={16} className="text-slate-400 shrink-0 mt-0.5" />
          <span>
            {detail.user.deletion_requested
              ? 'This customer has requested account deletion, so subscription changes are disabled. Clear the request on the Profile tab to enable them.'
              : 'This customer has not completed their profile (name and address). Fill them in on the Profile tab to manage their subscription.'}
          </span>
        </div>
      ) : overview ? (
        <SubscriptionPanel key={overview.customer.id} overview={overview} onSaved={onSaved} onError={onError} />
      ) : !overviewError && (
        <div className="card p-8 flex items-center justify-center gap-2 text-slate-400"><Spinner /> Loading subscription...</div>
      )}

      <div className="card overflow-x-auto">
        <div className="px-4 pt-4">
          <SectionTitle title="Subscription history" />
        </div>
        {history.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-slate-400">No subscriptions yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Milk</th>
                <th>Qty / slot</th>
                <th>Rate</th>
                <th>Started</th>
                <th>Set up by</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-slate-700">{MILK_LABELS[s.milk_type] || s.milk_type}</td>
                  <td className="text-slate-600 whitespace-nowrap">{s.quantity_litres}L · {SLOT_LABELS[s.delivery_slot] || s.delivery_slot}</td>
                  <td className="text-slate-600 whitespace-nowrap">
                    {rupees(s.price_per_litre)}/L{s.price_overridden && <span className="badge badge-purple ml-1.5">custom</span>}
                  </td>
                  <td className="text-slate-500 whitespace-nowrap">{formatDate(s.start_date)}</td>
                  <td className="text-slate-500">{s.created_by?.type === 'admin' ? (s.created_by.username || 'Admin') : 'Customer'}</td>
                  <td className="whitespace-nowrap">
                    <span className={SUB_STATUS_BADGE[s.status] || 'badge badge-gray'}>{s.status}</span>
                    {s.status === 'cancelled' && s.cancelled_at && (
                      <span className="text-[11px] text-slate-400 ml-1.5">{formatDate(s.cancelled_at)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Instant orders ──────────────────────────────────────────────────────────

function InstantTab({ detail, onSaved, onError }) {
  const { user, instant_orders: orders, instant_summary: summary } = detail;
  const [busy, setBusy] = useState(null); // `${orderId}:${action}`
  const [dialog, setDialog] = useState(null); // { kind, order }
  const [blockOpen, setBlockOpen] = useState(false);

  async function run(key, request, message) {
    setBusy(key);
    try {
      await request();
      setDialog(null);
      setBlockOpen(false);
      await onSaved(message);
    } catch (err) {
      setDialog(null);
      setBlockOpen(false);
      await onError(err);
    } finally {
      setBusy(null);
    }
  }

  const accept = (order) => run(`${order.id}:accept`, () => api.put(`/instant/orders/admin/${order.id}/acknowledge`), 'Order accepted — customer notified');
  const deliver = (order) => run(`${order.id}:deliver`, () => api.put(`/instant/orders/admin/${order.id}/status`, { status: 'delivered' }), 'Marked delivered');
  const cancel = (order) => run(`${order.id}:cancel`, () => api.put(`/instant/orders/admin/${order.id}/status`, { status: 'cancelled' }), 'Order cancelled — customer notified');
  const reject = (order, reason) => run(`${order.id}:reject`, () => api.put(`/instant/orders/admin/${order.id}/reject`, { reason }), 'Order rejected — customer notified');
  const addToDue = (order) => run(
    `${order.id}:due`,
    () => api.post('/dues/admin/adjustment', {
      user_id: user.id,
      type: 'charge',
      amount: order.total_amount,
      category: 'instant_order',
      reference_type: 'instant_order',
      reference_id: order.id,
      date: order.date || detail.today,
      // The server links the order to the charge in the same transaction, so
      // the same order can never be added twice; no request id is needed.
      note: `Instant order of ${formatDate(order.date)} not paid on delivery`,
    }),
    `${rupees(order.total_amount)} added to the due — customer notified`
  );

  const isBusy = busy !== null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Instant orders" value={summary.total} />
        <SummaryCard label="Open now" value={summary.open} tone={summary.open > 0 ? 'text-amber-600' : 'text-slate-800'} />
        <SummaryCard label="Delivered value" value={rupees(summary.delivered_value)} />
        <SummaryCard label="Moved to due" value={`${summary.added_to_due} of ${summary.delivered}`} />
      </div>

      <div className={`card p-4 flex flex-wrap items-start justify-between gap-3 ${user.instant_orders_blocked ? 'border border-red-200 bg-red-50/40' : ''}`}>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <Zap size={14} className={user.instant_orders_blocked ? 'text-red-500' : 'text-amber-500'} />
            Instant orders are {user.instant_orders_blocked ? 'turned off' : 'allowed'} for this customer
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {user.instant_orders_blocked
              ? <>They see &quot;Instant delivery is not available on your account&quot; when they try to order.{user.instant_block_reason && <> Reason: <span className="text-slate-700">{user.instant_block_reason}</span></>}</>
              : 'Instant orders are cash on delivery. Turn them off for a customer who has not paid for earlier ones.'}
          </p>
        </div>
        {user.instant_orders_blocked ? (
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={isBusy}
            onClick={() => run('block', () => api.patch(`/users/admin/${user.id}`, { instant_orders_blocked: false }), 'Instant orders allowed again')}
          >
            {busy === 'block' ? <Spinner /> : <Check size={13} />} Allow instant orders
          </button>
        ) : (
          <button type="button" className="btn-danger btn-sm" disabled={isBusy} onClick={() => setBlockOpen(true)}>
            <Ban size={13} /> Turn off instant orders
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="card p-10 text-center">
          <Zap size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 font-medium">No instant orders yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {summary.total > orders.length && (
            <p className="text-xs text-slate-400">Showing the latest {orders.length} of {summary.total}.</p>
          )}
          {orders.map((order) => {
            const status = INSTANT_STATUS[order.status] || { label: order.status, badge: 'badge badge-gray' };
            return (
              <div key={order.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={status.badge}>{status.label}</span>
                      {order.due_adjustment_id && <span className="badge badge-purple">on account</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Placed {formatDateTime(order.placed_at)} · #{order.id.slice(0, 8)}</p>
                  </div>
                  <p className="text-lg font-bold text-slate-800">{rupees(order.total_amount)}</p>
                </div>

                <ul className="mt-2 text-sm text-slate-600 space-y-0.5">
                  {order.items.map((item) => (
                    <li key={item.product_id} className="flex justify-between gap-3">
                      <span className="truncate">{item.product_name} × {item.quantity}</span>
                      <span className="text-slate-500 shrink-0">{rupees(item.total)}</span>
                    </li>
                  ))}
                  {(order.delivery_charge > 0 || order.extra_charges_total > 0) && (
                    <li className="flex justify-between gap-3 text-xs text-slate-400">
                      <span>Delivery & charges</span>
                      <span>{rupees(order.delivery_charge + order.extra_charges_total)}</span>
                    </li>
                  )}
                </ul>

                {order.rejection_reason && (
                  <p className="text-xs text-red-600 mt-2">Rejected: {order.rejection_reason}</p>
                )}
                {order.status === 'cancelled' && order.cancelled_by === 'customer' && (
                  <p className="text-xs text-slate-500 mt-2">Cancelled by the customer</p>
                )}

                <div className="flex flex-wrap gap-2 mt-3 empty:hidden">
                  {order.status === 'pending' && (
                    <>
                      <button type="button" className="btn-primary btn-sm" disabled={isBusy} onClick={() => accept(order)}>
                        {busy === `${order.id}:accept` ? <Spinner /> : <Check size={13} />} Accept
                      </button>
                      <button type="button" className="btn-secondary btn-sm" disabled={isBusy} onClick={() => setDialog({ kind: 'reject', order })}>
                        <X size={13} /> Reject
                      </button>
                    </>
                  )}
                  {order.status === 'acknowledged' && (
                    <>
                      <button type="button" className="btn-primary btn-sm" disabled={isBusy} onClick={() => deliver(order)}>
                        {busy === `${order.id}:deliver` ? <Spinner /> : <Truck size={13} />} Mark delivered
                      </button>
                      <button type="button" className="btn-secondary btn-sm" disabled={isBusy} onClick={() => setDialog({ kind: 'cancel', order })}>
                        <X size={13} /> Cancel
                      </button>
                    </>
                  )}
                  {order.status === 'delivered' && !order.due_adjustment_id && order.total_amount > 0 && (
                    <button type="button" className="btn-secondary btn-sm" disabled={isBusy} onClick={() => setDialog({ kind: 'due', order })}>
                      <Plus size={13} /> Add {rupees(order.total_amount)} to due
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialog?.kind === 'reject' && (
        <PromptDialog
          title="Reject this order?"
          label="Reason shown to the customer"
          placeholder="e.g. Out of paneer right now"
          confirmLabel="Reject order"
          required
          danger
          busy={isBusy}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => reject(dialog.order, reason)}
        />
      )}
      {dialog?.kind === 'cancel' && (
        <ConfirmDialog
          title="Cancel this order?"
          confirmLabel="Cancel order"
          danger
          busy={isBusy}
          onCancel={() => setDialog(null)}
          onConfirm={() => cancel(dialog.order)}
        >
          <p>The {rupees(dialog.order.total_amount)} order is cancelled and the customer is notified.</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'due' && (
        <ConfirmDialog
          title={`Add ${rupees(dialog.order.total_amount)} to the due?`}
          confirmLabel="Add to due"
          busy={isBusy}
          onCancel={() => setDialog(null)}
          onConfirm={() => addToDue(dialog.order)}
        >
          <p>
            Use this when the customer did not pay cash for this instant order. The amount moves onto their account and they are notified.
            It can be reversed from the Dues tab.
          </p>
        </ConfirmDialog>
      )}
      {blockOpen && (
        <PromptDialog
          title="Turn off instant orders?"
          label="Reason (for admins; the customer does not see it)"
          placeholder="e.g. Two cash orders unpaid"
          confirmLabel="Turn off"
          danger
          busy={isBusy}
          onCancel={() => setBlockOpen(false)}
          onConfirm={(reason) => run(
            'block',
            () => api.patch(`/users/admin/${user.id}`, { instant_orders_blocked: true, instant_block_reason: reason || null }),
            'Instant orders turned off for this customer'
          )}
        >
          <p>
            {user.name || 'The customer'} can still browse and fill the instant cart, but placing the order is refused with
            &quot;Instant delivery is not available on your account right now&quot;. Open orders are not affected.
          </p>
        </PromptDialog>
      )}
    </div>
  );
}

// ─── Deliveries (regular orders) ─────────────────────────────────────────────

function DeliveriesTab({ detail, onSaved, onError, onCalendar }) {
  const { orders, today } = detail;
  const [dialog, setDialog] = useState(null); // { kind: 'deliver' | 'cancel', order }
  const [busy, setBusy] = useState(false);

  async function setStatus(order, status) {
    setBusy(true);
    try {
      await api.put(`/orders/admin/${order.id}/status`, { status });
      setDialog(null);
      await onSaved(status === 'delivered'
        ? `Marked delivered — ${rupees(order.total_amount)} added to the due`
        : 'Delivery cancelled — customer notified');
    } catch (err) {
      setDialog(null);
      await onError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {orders.length === 0 ? 'No deliveries yet.' : `Latest ${orders.length} of ${detail.orders_total} deliveries.`}
        </p>
        <button type="button" className="btn-secondary btn-sm" onClick={onCalendar}>
          <CalendarDays size={13} /> Month calendar
        </button>
      </div>

      {orders.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Milk</th>
                <th>Products</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const status = ORDER_STATUS[order.status] || { label: order.status, badge: 'badge badge-gray' };
                const extras = order.extra_items.map((i) => `${i.product_name} × ${i.quantity}`).join(', ');
                return (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap text-slate-600">
                      {formatDate(order.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                      {order.delivery_slot && <span className="block text-[11px] text-slate-400">{SLOT_LABELS[order.delivery_slot] || order.delivery_slot}</span>}
                    </td>
                    <td className="whitespace-nowrap text-slate-600">{describeMilk(order.milk) || '—'}</td>
                    <td className="text-slate-500 max-w-[260px]"><span className="block truncate" title={extras}>{extras || '—'}</span></td>
                    <td className="text-right font-semibold text-slate-700 whitespace-nowrap">{rupees(order.total_amount)}</td>
                    <td><span className={status.badge}>{status.label}</span></td>
                    <td className="whitespace-nowrap text-right">
                      {order.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          {order.date <= today && (
                            <button type="button" className="btn-secondary btn-sm" onClick={() => setDialog({ kind: 'deliver', order })}>
                              <Check size={13} /> Delivered
                            </button>
                          )}
                          <button type="button" className="btn-ghost btn-sm" onClick={() => setDialog({ kind: 'cancel', order })}>
                            <X size={13} /> Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        <Info size={15} className="shrink-0 mt-0.5" />
        <span>Marking a delivery as delivered adds its amount to the customer&apos;s due. To change an upcoming delivery, use the Subscription tab or Order for customer.</span>
      </div>

      {dialog && (
        <ConfirmDialog
          title={dialog.kind === 'deliver' ? 'Mark as delivered?' : 'Cancel this delivery?'}
          confirmLabel={dialog.kind === 'deliver' ? 'Mark delivered' : 'Cancel delivery'}
          danger={dialog.kind === 'cancel'}
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => setStatus(dialog.order, dialog.kind === 'deliver' ? 'delivered' : 'cancelled')}
        >
          <p>
            {dialog.kind === 'deliver'
              ? `The delivery of ${formatDate(dialog.order.date)} is confirmed and ${rupees(dialog.order.total_amount)} is added to the due. The customer is notified.`
              : `The delivery of ${formatDate(dialog.order.date)} is cancelled and will not be billed. The customer is notified.`}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
