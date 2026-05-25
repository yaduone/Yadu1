import { createElement, useState, useEffect } from 'react';
import api from '../services/api';
import SearchField from '../components/SearchField';
import {
  AlertTriangle, Trash2, Users, UserCheck, UserX, UserMinus,
  HelpCircle, ShieldAlert, ShoppingCart, X, Package, Milk, Loader2,
  CalendarDays, ChevronLeft, ChevronRight,
} from 'lucide-react';

const STATUS_BADGE = {
  active:    'badge badge-green',
  paused:    'badge badge-yellow',
  cancelled: 'badge badge-red',
};

const MILK_LABELS = { cow: 'Cow', buffalo: 'Buffalo', toned: 'Child Pack' };
const MILK_COLORS = {
  cow:     'bg-amber-50 text-amber-700 ring-amber-100',
  buffalo: 'bg-blue-50 text-blue-700 ring-blue-100',
  toned:   'bg-emerald-50 text-emerald-700 ring-emerald-100',
};
const DELIVERY_STATUS = {
  delivered: {
    label: 'Delivered',
    badge: 'badge badge-green',
    dot: 'bg-emerald-500',
    cell: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  pending: {
    label: 'Pending',
    badge: 'badge badge-yellow',
    dot: 'bg-amber-500',
    cell: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
  not_delivered: {
    label: 'Not Delivered',
    badge: 'badge badge-red',
    dot: 'bg-red-500',
    cell: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  },
};
const INITIAL_CALENDAR_MONTH = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
})();

const FILTER_CONFIG = [
  { key: 'active',             label: 'Active',           icon: UserCheck,   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'paused',             label: 'Paused',           icon: UserMinus,   color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200'   },
  { key: 'cancelled',          label: 'Cancelled',        icon: UserX,       color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200'     },
  { key: 'no_sub',             label: 'No Sub',           icon: HelpCircle,  color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200'   },
  { key: 'deletion_requested', label: 'Delete Requests',  icon: ShieldAlert, color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-300'    },
];

function CartModal({ user, onClose }) {
  const [cart, setCart]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get(`/cart/admin/user/${user.id}`)
      .then((res) => setCart(res.data.data))
      .catch(() => setError('Failed to load cart.'))
      .finally(() => setLoading(false));
  }, [user.id]);

  const milkColorCls = cart?.effective_milk
    ? (MILK_COLORS[cart.effective_milk.milk_type] || 'bg-slate-50 text-slate-700 ring-slate-100')
    : '';

  const dateLabel = cart?.date
    ? new Date(cart.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">{user.name ? user.name[0].toUpperCase() : '?'}</span>
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm leading-tight">{user.name || user.phone || 'Unknown'}</p>
              <p className="text-[10px] text-slate-400">{user.phone || user.id.slice(0, 12)}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading cart...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <AlertTriangle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {cart && (
            <>
              {/* Date & lock status */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{dateLabel}</p>
                {cart.is_locked && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Locked</span>
                )}
              </div>

              {/* Milk section */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Milk Delivery</p>
                {cart.is_skipped ? (
                  <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100 px-4 py-3 text-sm text-slate-500 italic">
                    Delivery skipped for this day
                  </div>
                ) : cart.effective_milk ? (
                  <div className={`rounded-xl ring-1 px-4 py-3 ${milkColorCls}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Milk size={14} />
                      <span className="font-semibold capitalize">
                        {MILK_LABELS[cart.effective_milk.milk_type] || cart.effective_milk.milk_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      {/* Base quantity */}
                      {cart.subscription && (
                        <span className="opacity-70">
                          Base: {cart.subscription.base_quantity}L
                        </span>
                      )}
                      {/* Override indicator */}
                      {cart.override && (
                        <>
                          <span className="opacity-40">→</span>
                          <span className="font-bold">
                            Modified: {cart.effective_milk.quantity_litres}L
                            {cart.subscription && (
                              <span className="ml-1 font-normal opacity-70">
                                ({cart.effective_milk.quantity_litres > cart.subscription.base_quantity ? '+' : ''}
                                {(cart.effective_milk.quantity_litres - cart.subscription.base_quantity).toFixed(1)}L)
                              </span>
                            )}
                          </span>
                        </>
                      )}
                      {!cart.override && (
                        <span className="font-bold">{cart.effective_milk.quantity_litres}L</span>
                      )}
                      <span className="ml-auto font-bold">₹{cart.effective_milk.total?.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100 px-4 py-3 text-sm text-slate-400 italic">
                    No active subscription
                  </div>
                )}
              </div>

              {/* Extra items */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Extra Items
                  {cart.extra_items.length > 0 && (
                    <span className="ml-1.5 text-blue-600 normal-case font-bold">{cart.extra_items.length} item{cart.extra_items.length !== 1 ? 's' : ''}</span>
                  )}
                </p>
                {cart.extra_items.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100 px-4 py-3 text-sm text-slate-400 italic">
                    No extra items in cart
                  </div>
                ) : (
                  <div className="rounded-xl ring-1 ring-slate-100 overflow-hidden divide-y divide-slate-50">
                    {cart.extra_items.map((item) => (
                      <div key={item.product_id} className="flex items-center gap-3 px-4 py-2.5">
                        <Package size={14} className="text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{item.product_name}</p>
                          {item.unit && <p className="text-[10px] text-slate-400">{item.unit} · ₹{item.price} each</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-slate-800">×{item.quantity}</p>
                          <p className="text-xs text-slate-500">₹{item.total?.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total */}
              {(cart.effective_milk || cart.extra_items.length > 0) && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <p className="text-sm font-semibold text-slate-600">Total for this delivery</p>
                  <p className="text-lg font-bold text-slate-800">₹{cart.total_amount?.toFixed(2)}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}

function normalizeDeliveryStatus(status) {
  return status === 'skipped' || status === 'cancelled' ? 'not_delivered' : status;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function moveMonth(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function nonDeliveryReason(entry) {
  if (entry.non_delivery_reason === 'skipped') return 'Skipped by user';
  if (entry.non_delivery_reason === 'not_marked_delivered') return 'Not confirmed as delivered';
  if (entry.non_delivery_reason === 'cancelled') return 'Delivery was cancelled';
  return 'Delivery was not completed';
}

function DeliveryCalendarModal({ user, onClose }) {
  const [focusedMonth, setFocusedMonth] = useState(INITIAL_CALENDAR_MONTH);
  const [selectedDate, setSelectedDate] = useState('');
  const [result, setResult] = useState({ requestKey: '', data: null, error: '' });
  const requestedMonth = monthKey(focusedMonth);

  useEffect(() => {
    let cancelled = false;
    api.get(`/users/admin/${user.id}/calendar?month=${requestedMonth}`)
      .then((res) => {
        if (!cancelled) {
          setResult({ requestKey: requestedMonth, data: res.data.data, error: '' });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ requestKey: requestedMonth, data: null, error: 'Failed to load delivery calendar.' });
        }
      });
    return () => { cancelled = true; };
  }, [user.id, requestedMonth]);

  const currentData = result.requestKey === requestedMonth ? result.data : null;
  const error = result.requestKey === requestedMonth ? result.error : '';
  const loading = !currentData && !error;
  const calendar = currentData?.calendar || {};
  const summary = currentData?.summary || {};
  const selectedEntry = calendar[selectedDate];
  const selectedStatus = selectedEntry
    ? DELIVERY_STATUS[normalizeDeliveryStatus(selectedEntry.status)]
    : null;
  const firstOffset = new Date(focusedMonth.getFullYear(), focusedMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(focusedMonth.getFullYear(), focusedMonth.getMonth() + 1, 0).getDate();
  const canGoNext = requestedMonth < monthKey(INITIAL_CALENDAR_MONTH);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-scale-in overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <CalendarDays size={16} />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm leading-tight">Delivery Calendar</p>
              <p className="text-[10px] text-slate-400">{user.name || user.phone || 'Unknown user'}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setFocusedMonth((month) => moveMonth(month, -1))}
              className="btn-icon text-slate-500 hover:text-blue-600 hover:bg-blue-50"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <p className="font-semibold text-slate-700">
              {focusedMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
            <button
              type="button"
              onClick={() => setFocusedMonth((month) => moveMonth(month, 1))}
              disabled={!canGoNext}
              className="btn-icon text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex flex-wrap gap-3 mb-4 text-xs">
            {Object.values(DELIVERY_STATUS).map((status) => (
              <span key={status.label} className="inline-flex items-center gap-1.5 text-slate-500">
                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading calendar...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <AlertTriangle size={14} className="shrink-0" />
              {error}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <span key={day} className="text-[10px] font-bold text-slate-400 uppercase">{day}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstOffset }).map((_, index) => (
                  <span key={`empty-${index}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const date = `${requestedMonth}-${String(day).padStart(2, '0')}`;
                  const entry = calendar[date];
                  const status = entry ? DELIVERY_STATUS[normalizeDeliveryStatus(entry.status)] : null;
                  return (
                    <button
                      type="button"
                      key={date}
                      disabled={!entry}
                      title={status ? status.label : 'No delivery record'}
                      onClick={() => setSelectedDate(date)}
                      className={`h-11 rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition ${
                        status ? status.cell : 'text-slate-400'
                      } ${selectedDate === date ? 'outline outline-2 outline-blue-400' : ''}`}
                    >
                      {day}
                      {status && <span className={`w-1.5 h-1.5 rounded-full mt-1 ${status.dot}`} />}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                {Object.entries(DELIVERY_STATUS).map(([key, status]) => (
                  <div key={key} className="rounded-xl border border-slate-100 p-2 text-center">
                    <p className="text-lg font-bold text-slate-700">{summary[key] || 0}</p>
                    <p className="text-[10px] text-slate-500">{status.label}</p>
                  </div>
                ))}
              </div>

              {selectedEntry && selectedStatus && (
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">
                      {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                    <span className={selectedStatus.badge}>{selectedStatus.label}</span>
                  </div>
                  {normalizeDeliveryStatus(selectedEntry.status) === 'not_delivered' && (
                    <p className="text-xs text-red-600 mt-2">{nonDeliveryReason(selectedEntry)}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers]     = useState([]);
  const [dueMap, setDueMap]   = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');
  const [cartUser, setCartUser] = useState(null);
  const [calendarUser, setCalendarUser] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/users/admin/list'), api.get('/dues/admin/list')])
      .then(([usersRes, duesRes]) => {
        setUsers(usersRes.data.data.users);
        const map = {};
        (duesRes.data.data.dues || []).forEach((d) => { map[d.user_id || d.id] = d.due_amount || 0; });
        setDueMap(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function openDelete(user) {
    setDeleteTarget(user);
    setDeleteError('');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/users/admin/${deleteTarget.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDueMap((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete user.');
    } finally {
      setDeleting(false);
    }
  }

  async function confirmAcceptDeletion() {
    if (!acceptTarget) return;
    setAccepting(true);
    setAcceptError('');
    try {
      await api.delete(`/users/admin/${acceptTarget.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== acceptTarget.id));
      setDueMap((prev) => { const next = { ...prev }; delete next[acceptTarget.id]; return next; });
      setAcceptTarget(null);
    } catch (err) {
      setAcceptError(err.response?.data?.error || 'Failed to delete user.');
    } finally {
      setAccepting(false);
    }
  }

  const filtered = users.filter((u) => {
    if (filter === 'deletion_requested') return u.deletion_requested === true;
    const subStatus = u.subscription?.status ?? 'no_sub';
    if (filter !== 'all' && subStatus !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        u.address?.line1?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = users.reduce((acc, u) => {
    const s = u.subscription?.status ?? 'no_sub';
    acc[s] = (acc[s] || 0) + 1;
    if (u.deletion_requested) acc.deletion_requested = (acc.deletion_requested || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="page-title">Users</h2>
        <p className="text-xs text-slate-400 mt-0.5">{users.length} total in your area</p>
      </div>

      {/* Summary filter cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        {FILTER_CONFIG.map(({ key, label, icon, color, bg, border }) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={`${bg} rounded-2xl p-3 sm:p-4 text-left border-2 transition-all ${
              filter === key ? `${border} shadow-sm` : 'border-transparent'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              {createElement(icon, { size: 15, className: color })}
              {filter === key && <span className="text-[9px] font-bold text-slate-400 uppercase">Active</span>}
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${color}`}>{counts[key] || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search name or phone..."
          className="flex-1"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="select w-32 sm:w-40"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_sub">No Sub</option>
          <option value="deletion_requested">Delete Requests</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-16 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Users size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No users found</p>
          <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="space-y-2 sm:hidden">
            {filtered.map((user) => {
              const sub = user.subscription;
              const due = dueMap[user.id] ?? null;
              return (
                <div key={user.id} className={`card p-4 ${user.deletion_requested ? 'border border-rose-200 bg-rose-50/30' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-sm font-bold">
                        {user.name ? user.name[0].toUpperCase() : '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-800 text-sm truncate">
                          {user.name || <span className="text-slate-400 italic font-normal">Incomplete</span>}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {user.deletion_requested && (
                            <span className="badge badge-red">delete req</span>
                          )}
                          {sub ? (
                            <span className={STATUS_BADGE[sub.status] || 'badge badge-gray'}>
                              {sub.status}
                            </span>
                          ) : (
                            <span className="badge badge-gray">no sub</span>
                          )}
                          <button
                            type="button"
                            onClick={() => setCartUser(user)}
                            className="btn-icon text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                            title="View cart"
                            aria-label={`View cart for ${user.name || user.phone || 'user'}`}
                          >
                            <ShoppingCart size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCalendarUser(user)}
                            className="btn-icon text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="View delivery calendar"
                            aria-label={`View delivery calendar for ${user.name || user.phone || 'user'}`}
                          >
                            <CalendarDays size={14} />
                          </button>
                          {user.deletion_requested ? (
                            <button
                              type="button"
                              onClick={() => { setAcceptTarget(user); setAcceptError(''); }}
                              className="btn-icon text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              title="Accept deletion request"
                              aria-label={`Accept deletion for ${user.name || user.phone || 'user'}`}
                            >
                              <ShieldAlert size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openDelete(user)}
                              className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"
                              title="Delete user"
                              aria-label={`Delete ${user.name || user.phone || 'user'}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{user.phone || '—'}</p>
                      {user.address && (
                        <p className="text-xs text-slate-400 truncate">{user.address.line1}</p>
                      )}
                      {sub && (
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-xs text-slate-600 font-medium capitalize">
                            {MILK_LABELS[sub.milk_type] || sub.milk_type} · {sub.quantity_litres}L
                          </span>
                          <span className="text-xs font-semibold text-slate-700">₹{sub.daily_value}/day</span>
                          {due !== null && (
                            <span className={`text-xs font-bold ${due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              Due: ₹{due.toFixed(0)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="card overflow-x-auto hidden sm:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Milk</th>
                  <th>Qty / Day</th>
                  <th>₹ / Day</th>
                  <th>Since</th>
                  <th className="text-right">Due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const sub = user.subscription;
                  return (
                    <tr key={user.id} className={user.deletion_requested ? 'bg-rose-50/40' : ''}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
                            <span className="text-white text-xs font-bold">
                              {user.name ? user.name[0].toUpperCase() : '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">
                              {user.name || <span className="text-slate-400 italic font-normal">Incomplete</span>}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">{user.id.slice(0, 10)}…</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-600 whitespace-nowrap">{user.phone || '—'}</td>
                      <td className="text-slate-500 max-w-[160px]">
                        {user.address ? (
                          <span title={`${user.address.line1}, ${user.address.pincode}`} className="truncate block">
                            {user.address.line1}
                            {user.address.pincode && <span className="text-slate-400 ml-1">· {user.address.pincode}</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="whitespace-nowrap">
                        {sub ? (
                          <span className="font-medium text-slate-700 capitalize">
                            {MILK_LABELS[sub.milk_type] || sub.milk_type}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap text-slate-600">
                        {sub ? `${sub.quantity_litres} L` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap font-semibold text-slate-700">
                        {sub ? `₹${sub.daily_value}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap text-slate-500 text-xs">
                        {sub?.start_date || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        {(() => {
                          const due = dueMap[user.id] ?? null;
                          if (due === null) return <span className="text-slate-300">—</span>;
                          return (
                            <span className={`font-bold text-sm ${due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              ₹{due.toFixed(2)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {user.deletion_requested && (
                            <span className="badge badge-red">delete req</span>
                          )}
                          {sub ? (
                            <span className={STATUS_BADGE[sub.status] || 'badge badge-gray'}>
                              {sub.status}
                            </span>
                          ) : (
                            <span className="badge badge-gray">no sub</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCartUser(user)}
                            className="btn-icon text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                            title="View cart"
                            aria-label={`View cart for ${user.name || user.phone || 'user'}`}
                          >
                            <ShoppingCart size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCalendarUser(user)}
                            className="btn-icon text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="View delivery calendar"
                            aria-label={`View delivery calendar for ${user.name || user.phone || 'user'}`}
                          >
                            <CalendarDays size={14} />
                          </button>
                          {user.deletion_requested && (
                            <button
                              type="button"
                              onClick={() => { setAcceptTarget(user); setAcceptError(''); }}
                              className="btn-icon text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              title="Accept deletion request"
                              aria-label={`Accept deletion for ${user.name || user.phone || 'user'}`}
                            >
                              <ShieldAlert size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openDelete(user)}
                            className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"
                            title="Delete user"
                            aria-label={`Delete ${user.name || user.phone || 'user'}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Cart modal */}
      {cartUser && <CartModal user={cartUser} onClose={() => setCartUser(null)} />}
      {calendarUser && (
        <DeliveryCalendarModal user={calendarUser} onClose={() => setCalendarUser(null)} />
      )}

      {acceptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-scale-in">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <ShieldAlert size={18} className="text-rose-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Accept Account Deletion Request?</p>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-medium text-slate-700">
                    {acceptTarget.name || acceptTarget.phone || acceptTarget.id.slice(0, 10)}
                  </span>
                  {' '}requested deletion of their account. Accepting will permanently remove their profile, subscription, orders, dues, payments, and all associated data. This cannot be undone.
                </p>
                {acceptTarget.deletion_requested_at && (
                  <p className="text-xs text-rose-500 mt-2 font-medium">
                    Requested: {new Date(acceptTarget.deletion_requested_at._seconds
                      ? acceptTarget.deletion_requested_at._seconds * 1000
                      : acceptTarget.deletion_requested_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {acceptError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4">
                <AlertTriangle size={14} className="shrink-0" />
                {acceptError}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setAcceptTarget(null)}
                disabled={accepting}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAcceptDeletion}
                disabled={accepting}
                className="btn-danger disabled:opacity-60"
              >
                {accepting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : 'Accept & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-scale-in">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Delete User Permanently?</p>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-medium text-slate-700">
                    {deleteTarget.name || deleteTarget.phone || deleteTarget.id.slice(0, 10)}
                  </span>
                  {' '}will be removed from the database with subscriptions, cart, orders, dues, payments, tickets, and notifications. They will need to sign up and complete their profile again.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4">
                <AlertTriangle size={14} className="shrink-0" />
                {deleteError}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="btn-danger disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
