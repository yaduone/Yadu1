import { useState, useEffect } from 'react';
import api from '../services/api';
import SearchField from '../components/SearchField';
import LocationLink from '../components/LocationLink';
import { matchesSearch } from '../utils/search';
import {
  CheckCircle2, Clock, XCircle, CheckSquare, Zap, ShoppingCart, Truck,
} from 'lucide-react';

const STATUS_BADGE = {
  delivered: 'badge badge-green',
  pending: 'badge badge-yellow',
  not_delivered: 'badge badge-red',
  cancelled: 'badge badge-red',
};

const STATUS_ICON = {
  delivered: <CheckCircle2 size={13} className="text-emerald-500" />,
  pending: <Clock size={13} className="text-amber-500" />,
  not_delivered: <XCircle size={13} className="text-red-500" />,
  cancelled: <XCircle size={13} className="text-red-400" />,
};

const TABS = [
  { key: 'orders', label: 'Orders', icon: Truck },
  { key: 'carts', label: 'Active Carts', icon: ShoppingCart },
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
    pending: 'Pending',
    not_delivered: 'Not Delivered',
  }[displayStatus(status)] || status;
}

function itemsQuantity(rec) {
  return (rec.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
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

  function loadOrders() {
    setOrdersLoading(true);
    setSelected([]);
    const params = new URLSearchParams({ date, limit: '100' });
    if (statusFilter) params.set('status', statusFilter);
    api.get(`/instant/orders/admin/list?${params}`)
      .then((res) => setOrders(res.data.data.orders || []))
      .catch(console.error)
      .finally(() => setOrdersLoading(false));
  }

  function loadCarts() {
    setCartsLoading(true);
    api.get('/instant/carts/admin/list')
      .then((res) => setCarts(res.data.data.carts || []))
      .catch(console.error)
      .finally(() => setCartsLoading(false));
  }

  useEffect(() => { loadOrders(); /* eslint-disable-next-line */ }, [date, statusFilter]);
  useEffect(() => { loadCarts(); }, []);

  async function markDelivered(id) {
    try {
      await api.put(`/instant/orders/admin/${id}/status`, { status: 'delivered' });
      loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  async function markSelectedDelivered() {
    if (!selected.length) return;
    if (!window.confirm(`Mark ${selected.length} instant orders as delivered?`)) return;
    setOrdersLoading(true);
    try {
      await Promise.all(selected.map((id) => api.put(`/instant/orders/admin/${id}/status`, { status: 'delivered' })));
      setSelected([]);
      loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update some orders');
      loadOrders();
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

  const pendingOrders = visibleOrders.filter((o) => o.status === 'pending');
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
        {activeTab === 'orders' && selected.length > 0 && (
          <button onClick={markSelectedDelivered} className="btn-sm bg-violet-600 text-white hover:bg-violet-700 animate-fade-in shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold">
            <CheckSquare size={14} />
            Mark {selected.length} Delivered
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-1 flex gap-1">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          const count = key === 'orders' ? orders.length : carts.length;
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
              <span className={`hidden sm:inline text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === 'orders' && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setDate(today)} className={`btn-sm ${date === today ? 'btn-primary' : 'btn-ghost'}`}>
            Today
          </button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-auto flex-1 sm:flex-none" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select w-36 flex-1 sm:flex-none">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="delivered">Delivered</option>
            <option value="not_delivered">Not Delivered</option>
          </select>
        </div>
      )}

      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Search by customer, phone or item..."
      />

      {activeTab === 'orders' && !ordersLoading && visibleOrders.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'pending', label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
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
                  onDelivered={() => markDelivered(order.id)}
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
                        checked={pendingOrders.length > 0 && selected.length === pendingOrders.length}
                        onChange={(e) => setSelected(e.target.checked ? pendingOrders.map((o) => o.id) : [])}
                        disabled={pendingOrders.length === 0}
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
                      onDelivered={() => markDelivered(order.id)}
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

function OrderCard({ order, selected, onSelect, onDelivered }) {
  return (
    <div className={`card p-4 ${selected ? 'ring-2 ring-violet-300' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {order.status === 'pending' && (
            <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} className="mt-0.5 rounded border-slate-300 text-violet-600" />
          )}
          <div className="min-w-0">
            <CustomerBlock rec={order} />
            <div className="mt-1.5"><ItemList items={order.items} /></div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0 w-32">
          <StatusBadge status={order.status} />
          <ChargeBreakdown rec={order} />
        </div>
      </div>
      {order.status === 'pending' && (
        <button onClick={onDelivered} className="btn btn-sm bg-violet-600 text-white w-full justify-center mt-3 hover:bg-violet-700">
          <CheckCircle2 size={13} />
          Mark Delivered
        </button>
      )}
    </div>
  );
}

function OrderRow({ order, selected, onSelect, onDelivered }) {
  return (
    <tr className={selected ? 'bg-violet-50/60' : ''}>
      <td className="text-center">
        {order.status === 'pending' && (
          <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} className="rounded border-slate-300 w-4 h-4 text-violet-600 focus:ring-violet-500" />
        )}
      </td>
      <td><CustomerBlock rec={order} /></td>
      <td className="text-slate-700"><ItemList items={order.items} /></td>
      <td className="min-w-[140px]"><ChargeBreakdown rec={order} /></td>
      <td><StatusBadge status={order.status} /></td>
      <td>
        {order.status === 'pending' && (
          <button onClick={onDelivered} className="btn btn-sm bg-violet-600 text-white hover:bg-violet-700">
            <CheckCircle2 size={13} />
            Delivered
          </button>
        )}
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
