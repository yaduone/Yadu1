import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useLiveRefresh } from '../hooks/useLiveRefresh';
import LiveIndicator from '../components/LiveIndicator';
import SearchField from '../components/SearchField';
import LocationLink from '../components/LocationLink';
import { matchesSearch } from '../utils/search';
import { requestAdminPushToken, onForegroundMessage } from '../firebase';
import {
  CheckCircle2, Clock, XCircle, CheckSquare, Zap, ShoppingCart, Truck, Settings, Bell, BellOff,
  PackageCheck, AlertTriangle, Wallet, Save,
} from 'lucide-react';

function NotifyConfigButton() {
  const [status, setStatus] = useState('idle'); // idle | granted | denied | error

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setStatus('granted');
    }
  }, []);

  async function enableNotifications() {
    setStatus('idle');
    try {
      const token = await requestAdminPushToken();
      if (!token) {
        setStatus('denied');
        return;
      }
      await api.put('/settings/admin-fcm-token', { token });
      setStatus('granted');
    } catch (err) {
      console.error(err);
      setStatus('error');
      alert(err.message || 'Could not enable notifications');
    }
  }

  const label = status === 'granted' ? 'Alerts on' : 'Enable alerts';
  const Icon = status === 'granted' ? Bell : status === 'denied' ? BellOff : Settings;

  return (
    <button
      type="button"
      onClick={enableNotifications}
      title="Enable instant-order push notifications on this device"
      className={`btn-sm shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold border ${
        status === 'granted'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

const STATUS_BADGE = {
  delivered: 'badge badge-green',
  pending: 'badge badge-yellow',
  acknowledged: 'badge badge-blue',
  not_delivered: 'badge badge-red',
  cancelled: 'badge badge-red',
  rejected: 'badge badge-red',
};

const STATUS_ICON = {
  delivered: <CheckCircle2 size={13} className="text-emerald-500" />,
  pending: <Clock size={13} className="text-amber-500" />,
  acknowledged: <PackageCheck size={13} className="text-blue-500" />,
  not_delivered: <XCircle size={13} className="text-red-500" />,
  cancelled: <XCircle size={13} className="text-red-400" />,
  rejected: <XCircle size={13} className="text-red-400" />,
};

const TABS = [
  { key: 'orders', label: 'Orders', icon: Truck },
  { key: 'carts', label: 'Active Carts', icon: ShoppingCart },
  { key: 'settings', label: 'Delivery Window', icon: Settings },
];

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function money(amount) {
  return `Rs.${(Number(amount) || 0).toFixed(2)}`;
}

function displayStatus(status) {
  return status === 'cancelled' ? 'not_delivered' : status;
}

function statusLabel(status) {
  return {
    delivered: 'Delivered',
    pending: 'New',
    acknowledged: 'On The Way',
    not_delivered: 'Not Delivered',
    // Kept distinct from cancelled: rejected means never accepted in the first
    // place, either by an admin or by the auto-expiry job.
    rejected: 'Rejected',
  }[displayStatus(status)] || status;
}

function itemsQuantity(rec) {
  return (rec.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
}

function CodBadge() {
  return (
    <span className="badge bg-slate-50 text-slate-500 border border-slate-200 flex items-center gap-1 w-fit">
      <Wallet size={11} />
      COD
    </span>
  );
}

export default function InstantOrdersPage() {
  const [activeTab, setActiveTab] = useState('orders');
  const today = formatDateInput(new Date());

  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [date, setDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState([]);

  // Carts state
  const [carts, setCarts] = useState([]);
  const [cartsLoading, setCartsLoading] = useState(true);

  const [search, setSearch] = useState('');

  // Delivery-window settings state
  // Order awaiting a rejection reason in the modal, or null.
  const [rejectTarget, setRejectTarget] = useState(null);
  const [hours, setHours] = useState(null);
  const [hoursDraft, setHoursDraft] = useState(null);
  const [hoursLoading, setHoursLoading] = useState(true);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursMessage, setHoursMessage] = useState({ type: '', text: '' });

  function loadHours() {
    setHoursLoading(true);
    api.get('/settings/instant-hours')
      .then((res) => {
        const h = res.data.data.hours;
        setHours(h);
        setHoursDraft(h);
      })
      .catch(console.error)
      .finally(() => setHoursLoading(false));
  }

  async function saveHours() {
    setHoursSaving(true);
    setHoursMessage({ type: '', text: '' });
    try {
      const res = await api.put('/settings/instant-hours', hoursDraft);
      const h = res.data.data.hours;
      setHours(h);
      setHoursDraft(h);
      setHoursMessage({ type: 'success', text: 'Delivery window updated' });
    } catch (err) {
      setHoursMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update delivery window' });
    } finally {
      setHoursSaving(false);
    }
  }

  useEffect(() => { loadHours(); }, []);

  // `silent` drives background refreshes: no skeleton, and the operator's
  // checkbox selection survives. A visible reload still clears selection, since
  // that follows an action the operator just took.
  function loadOrders({ silent = false } = {}) {
    if (!silent) {
      setOrdersLoading(true);
      setSelected([]);
    }
    const params = new URLSearchParams({ date, limit: '100' });
    if (statusFilter) params.set('status', statusFilter);
    return api.get(`/instant/orders/admin/list?${params}`)
      .then((res) => {
        const fresh = res.data.data.orders || [];
        setOrders(fresh);
        // Drop any selected order that has since left the list (delivered by a
        // colleague, filtered out) so bulk actions can't fire on stale ids.
        if (silent) {
          setSelected((prev) => prev.filter((id) => fresh.some((o) => o.id === id)));
        }
      })
      .catch(console.error)
      .finally(() => { if (!silent) setOrdersLoading(false); });
  }

  function loadCarts({ silent = false } = {}) {
    if (!silent) setCartsLoading(true);
    return api.get('/instant/carts/admin/list')
      .then((res) => setCarts(res.data.data.carts || []))
      .catch(console.error)
      .finally(() => { if (!silent) setCartsLoading(false); });
  }

  useEffect(() => { loadOrders(); /* eslint-disable-next-line */ }, [date, statusFilter]);
  useEffect(() => { loadCarts(); }, []);

  // Live updates. New instant orders are time-critical — a customer is sitting on
  // a "Requested" screen waiting — so poll briskly and also refresh the moment an
  // FCM push announces one, rather than waiting out the interval.
  const refreshVisibleTab = useCallback(() => {
    return activeTab === 'carts'
      ? loadCarts({ silent: true })
      : loadOrders({ silent: true });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [activeTab, date, statusFilter]);

  const { lastUpdated, refreshNow } = useLiveRefresh(refreshVisibleTab, {
    intervalMs: 15_000,
    enabled: activeTab !== 'settings', // nothing on the settings tab goes stale
  });

  useEffect(() => {
    let unsubscribe;
    let cancelled = false;
    onForegroundMessage(() => refreshNow()).then((fn) => {
      // Unmounted before the async messaging setup resolved — tear down at once
      // rather than leaking the listener.
      if (cancelled) fn?.();
      else unsubscribe = fn;
    });
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [refreshNow]);

  // Order actions patch the row in place instead of refetching the whole list.
  // The 15s live-refresh reconciles with the server shortly after, so a full
  // reload here only costs the operator a table flash between rapid actions.
  // On failure we do reload, since local state can no longer be trusted.
  function patchOrders(ids, changes) {
    const idSet = new Set(ids);
    setOrders((prev) => prev.map((o) => (idSet.has(o.id) ? { ...o, ...changes } : o)));
  }

  async function acknowledgeOrder(id) {
    try {
      await api.put(`/instant/orders/admin/${id}/acknowledge`);
      patchOrders([id], { status: 'acknowledged' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to acknowledge order');
      loadOrders({ silent: true });
    }
  }

  // Reject = decline a *pending* order with a reason the customer sees on their
  // order-status screen. Distinct from cancelling an already-accepted order.
  async function rejectOrder(id, reason) {
    try {
      await api.put(`/instant/orders/admin/${id}/reject`, { reason });
      setRejectTarget(null);
      patchOrders([id], { status: 'rejected', rejection_reason: reason });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject order');
      loadOrders({ silent: true });
    }
  }

  async function markDelivered(id) {
    try {
      await api.put(`/instant/orders/admin/${id}/status`, { status: 'delivered' });
      patchOrders([id], { status: 'delivered' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
      loadOrders({ silent: true });
    }
  }

  async function cancelOrder(id) {
    if (!window.confirm('Cancel this instant order?')) return;
    try {
      await api.put(`/instant/orders/admin/${id}/status`, { status: 'cancelled' });
      patchOrders([id], { status: 'cancelled' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel order');
      loadOrders({ silent: true });
    }
  }

  async function markSelectedAcknowledged() {
    if (!selected.length) return;
    const ids = selected;
    setSelected([]);
    patchOrders(ids, { status: 'acknowledged' });
    try {
      await Promise.all(ids.map((id) => api.put(`/instant/orders/admin/${id}/acknowledge`)));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to acknowledge some orders');
      loadOrders({ silent: true });
    }
  }

  async function markSelectedDelivered() {
    if (!selected.length) return;
    if (!window.confirm(`Mark ${selected.length} instant orders as delivered?`)) return;
    const ids = selected;
    setSelected([]);
    patchOrders(ids, { status: 'delivered' });
    try {
      await Promise.all(ids.map((id) => api.put(`/instant/orders/admin/${id}/status`, { status: 'delivered' })));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update some orders');
      loadOrders({ silent: true });
    }
  }

  const visibleOrders = orders.filter((order) => matchesSearch(search, [
    order.user_name, order.user_phone, order.user_id, order.user_address?.line1, order.status,
    ...(order.items || []).map((i) => i.product_name),
  ]));
  const visibleCarts = carts.filter((cart) => matchesSearch(search, [
    cart.user_name, cart.user_phone, cart.user_id, cart.user_address?.line1,
    ...(cart.items || []).map((i) => i.product_name),
  ]));

  // Selection is a single actionable group at a time: either all-pending (acknowledge)
  // or all-acknowledged (deliver) — mixing the two would make bulk actions ambiguous.
  const pendingOrders = visibleOrders.filter((o) => o.status === 'pending');
  const acknowledgedOrders = visibleOrders.filter((o) => o.status === 'acknowledged');
  const selectedStatus = selected.length
    ? (pendingOrders.some((o) => selected.includes(o.id)) ? 'pending' : 'acknowledged')
    : null;
  // "Select all" checkbox toggles pending orders by default, or acknowledged
  // ones if that's the group currently selected.
  const selectableOrders = selectedStatus === 'acknowledged' ? acknowledgedOrders : pendingOrders;
  const counts = visibleOrders.reduce((acc, o) => {
    const s = displayStatus(o.status);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const cartsValue = carts.reduce((sum, c) => sum + (Number(c.total_amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Zap size={20} className="text-violet-600" />
            Instant Delivery
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeTab === 'orders'
              ? `${visibleOrders.length} instant orders - ${date}`
              : `${visibleCarts.length} active carts - ${money(cartsValue)} in baskets`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'orders' && selected.length > 0 && selectedStatus === 'pending' && (
            <button onClick={markSelectedAcknowledged} className="btn-sm bg-blue-600 text-white hover:bg-blue-700 animate-fade-in shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold">
              <PackageCheck size={14} />
              Acknowledge {selected.length}
            </button>
          )}
          {activeTab === 'orders' && selected.length > 0 && selectedStatus === 'acknowledged' && (
            <button onClick={markSelectedDelivered} className="btn-sm bg-violet-600 text-white hover:bg-violet-700 animate-fade-in shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold">
              <CheckSquare size={14} />
              Mark {selected.length} Delivered
            </button>
          )}
          <NotifyConfigButton />
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-1 flex gap-1">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          const count = key === 'orders' ? orders.length : key === 'carts' ? carts.length : null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setActiveTab(key); setSearch(''); }}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                active ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon size={15} />
              <span className="truncate">{label}</span>
              {count !== null && (
                <span className={`hidden sm:inline text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'orders' && !hoursLoading && hours && (
        <div className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
          hours.enabled ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-red-200 bg-red-50 text-red-600'
        }`}>
          <Clock size={13} className="shrink-0" />
          {hours.enabled
            ? `Instant delivery window: ${hours.start_time} - ${hours.end_time} - promised in ${hours.eta_minutes} min after acceptance`
              + (hours.auto_expire_minutes > 0
                ? ` - unaccepted orders auto-reject after ${hours.auto_expire_minutes} min`
                : '')
            : 'Instant delivery is currently disabled for customers'}
        </div>
      )}

      {activeTab !== 'settings' && (
        <LiveIndicator lastUpdated={lastUpdated} onRefresh={refreshNow} />
      )}

      {activeTab === 'orders' && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setDate(today)} className={`btn-sm ${date === today ? 'btn-primary' : 'btn-ghost'}`}>
            Today
          </button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-auto flex-1 sm:flex-none" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select w-36 flex-1 sm:flex-none">
            <option value="">All Status</option>
            <option value="pending">New</option>
            <option value="acknowledged">On The Way</option>
            <option value="delivered">Delivered</option>
            <option value="not_delivered">Not Delivered</option>
          </select>
        </div>
      )}

      {activeTab !== 'settings' && (
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search by customer, phone or item..."
        />
      )}

      {activeTab === 'orders' && !ordersLoading && visibleOrders.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'pending', label: 'New', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
            { key: 'acknowledged', label: 'On The Way', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
            { key: 'delivered', label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { key: 'not_delivered', label: 'Not Delivered', cls: 'bg-red-50 text-red-600 border-red-200' },
          ].map(({ key, label, cls }) => counts[key] ? (
            <span key={key} className={`badge border ${cls}`}>
              {STATUS_ICON[key]}
              <span className="ml-1">{counts[key]} {label}</span>
            </span>
          ) : null)}
        </div>
      )}

      {/* ── Orders tab ─────────────────────────────────────────── */}
      {activeTab === 'orders' && (
        ordersLoading ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-slate-50" />)}</div>
        ) : orders.length === 0 ? (
          <EmptyState icon={Zap} message={`No instant orders for ${date}`} />
        ) : visibleOrders.length === 0 ? (
          <EmptyState icon={Zap} message="No instant orders match your search" />
        ) : (
          <>
            {/* Mobile */}
            <div className="space-y-2 sm:hidden">
              {visibleOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  selected={selected.includes(order.id)}
                  onSelect={(checked) => setSelected(checked ? [...selected, order.id] : selected.filter((id) => id !== order.id))}
                  onAcknowledge={() => acknowledgeOrder(order.id)}
                  onDelivered={() => markDelivered(order.id)}
                  onCancel={() => cancelOrder(order.id)}
                  onReject={() => setRejectTarget(order)}
                />
              ))}
            </div>
            {/* Desktop */}
            <div className="card overflow-hidden hidden sm:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectableOrders.length > 0 && selected.length === selectableOrders.length}
                        onChange={(e) => setSelected(e.target.checked ? selectableOrders.map((o) => o.id) : [])}
                        disabled={selectableOrders.length === 0}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                    </th>
                    <th>User</th>
                    <th>Items</th>
                    <th>Charges</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      selected={selected.includes(order.id)}
                      onSelect={(checked) => setSelected(checked ? [...selected, order.id] : selected.filter((id) => id !== order.id))}
                      onAcknowledge={() => acknowledgeOrder(order.id)}
                      onDelivered={() => markDelivered(order.id)}
                      onCancel={() => cancelOrder(order.id)}
                      onReject={() => setRejectTarget(order)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}

      {/* ── Active carts tab ───────────────────────────────────── */}
      {activeTab === 'carts' && (
        cartsLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-slate-50" />)}</div>
        ) : carts.length === 0 ? (
          <EmptyState icon={ShoppingCart} message="No saved instant carts right now" />
        ) : visibleCarts.length === 0 ? (
          <EmptyState icon={ShoppingCart} message="No carts match your search" />
        ) : (
          <div className="space-y-2">
            {visibleCarts.map((cart) => <CartCard key={cart.id} cart={cart} />)}
          </div>
        )
      )}

      {/* ── Delivery window settings tab ────────────────────────── */}
      {activeTab === 'settings' && (
        hoursLoading || !hoursDraft ? (
          <div className="card h-48 animate-pulse bg-slate-50" />
        ) : (
          <div className="card p-5 max-w-lg space-y-4">
            <div>
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Clock size={16} className="text-violet-600" />
                Instant Delivery Availability Window
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Customers can only place instant orders during this window. Outside it, the
                Instant tab shows as unavailable in the app.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={hoursDraft.enabled}
                onChange={(e) => setHoursDraft({ ...hoursDraft, enabled: e.target.checked })}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              Instant delivery enabled
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500">Start time</label>
                <input
                  type="time"
                  value={hoursDraft.start_time}
                  onChange={(e) => setHoursDraft({ ...hoursDraft, start_time: e.target.value })}
                  className="input mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">End time</label>
                <input
                  type="time"
                  value={hoursDraft.end_time}
                  onChange={(e) => setHoursDraft({ ...hoursDraft, end_time: e.target.value })}
                  className="input mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500">Promised delivery time (minutes after acknowledgement)</label>
              <input
                type="number"
                min="5"
                max="180"
                value={hoursDraft.eta_minutes}
                onChange={(e) => setHoursDraft({ ...hoursDraft, eta_minutes: Number(e.target.value) })}
                className="input mt-1 w-32"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500">
                Auto-reject unaccepted orders after (minutes)
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={hoursDraft.auto_expire_minutes}
                onChange={(e) => setHoursDraft({ ...hoursDraft, auto_expire_minutes: Number(e.target.value) })}
                className="input mt-1 w-32"
              />
              <p className="text-xs text-slate-400 mt-1">
                If nobody accepts a new order within this time, it is rejected automatically and
                the customer is notified. Set to <span className="font-semibold">0</span> to disable.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500">
                Customers can cancel their own order
              </label>
              <select
                value={hoursDraft.customer_cancel_window}
                onChange={(e) => setHoursDraft({ ...hoursDraft, customer_cancel_window: e.target.value })}
                className="input mt-1"
              >
                <option value="until_delivery">Until it is marked delivered</option>
                <option value="until_acceptance">Only before you accept it</option>
                <option value="disabled">Never - they must call the store</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">
                You are notified whenever a customer cancels, and the alert calls out
                cancellations on orders you had already accepted.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500">
                Rejection reasons (one per line)
              </label>
              <textarea
                rows={4}
                value={(hoursDraft.rejection_reasons || []).join('\n')}
                onChange={(e) => setHoursDraft({
                  ...hoursDraft,
                  rejection_reasons: e.target.value.split('\n'),
                })}
                className="input mt-1 font-mono text-xs"
              />
              <p className="text-xs text-slate-400 mt-1">
                Shown as one-tap options when rejecting an order. The customer sees the reason you pick.
              </p>
            </div>

            {hoursMessage.text && (
              <p className={`text-xs font-medium ${hoursMessage.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                {hoursMessage.text}
              </p>
            )}

            <button
              onClick={saveHours}
              disabled={hoursSaving || JSON.stringify(hoursDraft) === JSON.stringify(hours)}
              className="btn bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Save size={14} />
              {hoursSaving ? 'Saving...' : 'Save Window'}
            </button>
          </div>
        )
      )}

      {rejectTarget && (
        <RejectOrderModal
          order={rejectTarget}
          reasons={hours?.rejection_reasons || []}
          onCancel={() => setRejectTarget(null)}
          onConfirm={(reason) => rejectOrder(rejectTarget.id, reason)}
        />
      )}
    </div>
  );
}

/**
 * Asks the admin why a pending order is being turned down. The reason is pushed
 * to the customer and shown on their order-status screen, so it is required.
 */
function RejectOrderModal({ order, reasons, onCancel, onConfirm }) {
  const [reason, setReason] = useState(reasons[0] || '');
  const [custom, setCustom] = useState('');
  const usingCustom = reason === '__custom__';
  const finalReason = usingCustom ? custom.trim() : reason;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="card w-full max-w-md p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            Reject Order
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {order.user_name || 'Customer'} · {money(order.total_amount)} — they will be
            notified with the reason you choose.
          </p>
        </div>

        <div className="space-y-1.5">
          {reasons.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="reject-reason"
                checked={reason === r}
                onChange={() => setReason(r)}
                className="text-violet-600 focus:ring-violet-500"
              />
              {r}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="reject-reason"
              checked={usingCustom}
              onChange={() => setReason('__custom__')}
              className="text-violet-600 focus:ring-violet-500"
            />
            Other
          </label>
          {usingCustom && (
            <input
              type="text"
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Type a reason for the customer"
              className="input mt-1"
            />
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn btn-sm btn-ghost">Keep Order</button>
          <button
            onClick={() => onConfirm(finalReason)}
            disabled={!finalReason}
            className="btn btn-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject &amp; Notify
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="card p-12 text-center">
      <Icon size={40} className="mx-auto text-slate-300 mb-3" />
      <p className="text-slate-500 font-medium">{message}</p>
    </div>
  );
}

function CustomerBlock({ rec }) {
  const fallback = rec.user_id ? `${rec.user_id.slice(0, 10)}...` : 'Unknown';
  return (
    <div>
      <p className="font-semibold text-slate-800 text-sm">
        {rec.user_name || rec.user_phone || <span className="text-slate-400 italic font-normal text-xs">Unknown</span>}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">{rec.user_name ? (rec.user_phone || fallback) : fallback}</p>
      {rec.user_address?.line1 && (
        <p className="text-xs text-slate-400 truncate max-w-[160px]" title={rec.user_address.line1}>{rec.user_address.line1}</p>
      )}
      {rec.user_location && <div className="mt-1"><LocationLink location={rec.user_location} className="text-xs" size={12} /></div>}
    </div>
  );
}

function ItemList({ items }) {
  return (
    <ul className="space-y-0.5">
      {(items || []).map((item, idx) => (
        <li key={idx} className="text-xs text-slate-600">
          {item.product_name}{item.quantity ? ` x ${item.quantity}` : ''}
        </li>
      ))}
    </ul>
  );
}

function ChargeBreakdown({ rec }) {
  return (
    <div className="text-xs text-slate-500 space-y-0.5">
      <div className="flex justify-between gap-4"><span>Items</span><span>{money(rec.items_total)}</span></div>
      <div className="flex justify-between gap-4"><span>Delivery</span><span>{money(rec.delivery_charge)}</span></div>
      <div className="flex justify-between gap-4 font-bold text-slate-800 pt-0.5 border-t border-slate-100"><span>Total</span><span>{money(rec.total_amount)}</span></div>
      <div className="pt-0.5"><CodBadge /></div>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = displayStatus(status);
  return (
    <span className={`${STATUS_BADGE[normalized] || 'badge badge-gray'} flex items-center gap-1 w-fit`}>
      {STATUS_ICON[normalized]}
      {statusLabel(status)}
    </span>
  );
}

function EtaNote({ order }) {
  if (order.status !== 'acknowledged' || !order.expected_delivery_by) return null;
  const dueTime = new Date(order.expected_delivery_by).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (order.is_overdue) {
    return (
      <span className="badge bg-red-50 text-red-600 border border-red-200 flex items-center gap-1 w-fit">
        <AlertTriangle size={11} />
        Overdue - was due {dueTime}
      </span>
    );
  }
  return <span className="text-[11px] text-blue-600 font-medium">Due by {dueTime}</span>;
}

function OrderActions({ order, onAcknowledge, onDelivered, onCancel, onReject, className = '' }) {
  if (order.status === 'pending') {
    // A pending order was never accepted, so the negative action is Reject
    // (which requires a reason the customer sees), not Cancel.
    return (
      <div className={`flex gap-1.5 ${className}`}>
        <button onClick={onAcknowledge} className="btn btn-sm bg-blue-600 text-white flex-1 justify-center hover:bg-blue-700">
          <PackageCheck size={13} />
          Accept
        </button>
        <button onClick={onReject} className="btn btn-sm btn-ghost text-red-500 hover:bg-red-50" title="Reject order with a reason">
          <XCircle size={13} />
        </button>
      </div>
    );
  }
  if (order.status === 'acknowledged') {
    return (
      <div className={`flex gap-1.5 ${className}`}>
        <button onClick={onDelivered} className="btn btn-sm bg-violet-600 text-white flex-1 justify-center hover:bg-violet-700">
          <CheckCircle2 size={13} />
          Delivered
        </button>
        <button onClick={onCancel} className="btn btn-sm btn-ghost text-red-500 hover:bg-red-50" title="Cancel order">
          <XCircle size={13} />
        </button>
      </div>
    );
  }
  return null;
}

/**
 * Why an order ended the way it did — the rejection reason an admin picked, an
 * auto-expiry, or a customer cancellation. Without this the board shows a bare
 * "Rejected" with no way to tell a deliberate decline from a missed one.
 */
function OutcomeNote({ order }) {
  if (order.status === 'rejected') {
    const auto = order.rejected_by === 'auto_expiry';
    return (
      <p className={`text-xs mt-0.5 ${auto ? 'text-amber-600' : 'text-slate-400'}`}>
        {auto ? 'Auto-expired' : 'Rejected'}
        {order.rejection_reason ? `: ${order.rejection_reason}` : ''}
      </p>
    );
  }
  if (order.status === 'cancelled') {
    return (
      <p className="text-xs mt-0.5 text-slate-400">
        {order.cancelled_by === 'customer' ? 'Cancelled by customer' : 'Cancelled'}
      </p>
    );
  }
  return null;
}

function OrderCard({ order, selected, onSelect, onAcknowledge, onDelivered, onCancel, onReject }) {
  const selectable = order.status === 'pending' || order.status === 'acknowledged';
  return (
    <div className={`card p-4 ${selected ? 'ring-2 ring-violet-300' : ''} ${order.is_overdue ? 'ring-1 ring-red-300' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {selectable && (
            <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} className="mt-0.5 rounded border-slate-300 text-violet-600" />
          )}
          <div className="min-w-0">
            <CustomerBlock rec={order} />
            <div className="mt-1.5"><ItemList items={order.items} /></div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0 w-32">
          <StatusBadge status={order.status} />
          <EtaNote order={order} />
          <OutcomeNote order={order} />
          <ChargeBreakdown rec={order} />
        </div>
      </div>
      <OrderActions order={order} onAcknowledge={onAcknowledge} onDelivered={onDelivered} onCancel={onCancel} onReject={onReject} className="mt-3" />
    </div>
  );
}

function OrderRow({ order, selected, onSelect, onAcknowledge, onDelivered, onCancel, onReject }) {
  const selectable = order.status === 'pending' || order.status === 'acknowledged';
  return (
    <tr className={`${selected ? 'bg-violet-50/60' : ''} ${order.is_overdue ? 'bg-red-50/40' : ''}`}>
      <td className="text-center">
        {selectable && (
          <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} className="rounded border-slate-300 w-4 h-4 text-violet-600 focus:ring-violet-500" />
        )}
      </td>
      <td><CustomerBlock rec={order} /></td>
      <td className="text-slate-700"><ItemList items={order.items} /></td>
      <td className="min-w-[140px]"><ChargeBreakdown rec={order} /></td>
      <td className="space-y-1"><StatusBadge status={order.status} /><EtaNote order={order} /><OutcomeNote order={order} /></td>
      <td>
        <OrderActions order={order} onAcknowledge={onAcknowledge} onDelivered={onDelivered} onCancel={onCancel} onReject={onReject} />
      </td>
    </tr>
  );
}

function CartCard({ cart }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CustomerBlock rec={cart} />
          <div className="mt-2"><ItemList items={cart.items} /></div>
        </div>
        <div className="w-36 shrink-0">
          <span className="badge bg-violet-50 text-violet-700 border border-violet-200 flex items-center gap-1 w-fit mb-2">
            <ShoppingCart size={11} />{itemsQuantity(cart)} items
          </span>
          <ChargeBreakdown rec={cart} />
        </div>
      </div>
    </div>
  );
}
