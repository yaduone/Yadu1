import { useState, useEffect } from 'react';
import api from '../services/api';
import { CheckCircle2, Clock, XCircle, CheckSquare, Milk, Package } from 'lucide-react';

const STATUS_BADGE = {
  delivered: 'badge badge-green',
  pending: 'badge badge-yellow',
  cancelled: 'badge badge-red',
};

const STATUS_ICON = {
  delivered: <CheckCircle2 size={13} className="text-emerald-500" />,
  pending: <Clock size={13} className="text-amber-500" />,
  cancelled: <XCircle size={13} className="text-red-400" />,
};

const ORDER_TABS = [
  { key: 'milk', label: 'Subscription Milk', icon: Milk },
  { key: 'products', label: 'Products', icon: Package },
];

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function relativeDate(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return formatDateInput(date);
}

function getExtras(order) {
  return Array.isArray(order.extra_items) ? order.extra_items : [];
}

function getExtrasTotal(order) {
  return getExtras(order).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
}

function getExtrasQuantity(order) {
  return getExtras(order).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

function getDisplayAmount(order, activeTab) {
  if (activeTab === 'milk') return Number(order.milk?.total) || 0;
  return getExtrasTotal(order);
}

function money(amount) {
  return `Rs.${(Number(amount) || 0).toFixed(2)}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => relativeDate(0));
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('milk');

  function loadOrders() {
    setLoading(true);
    setSelectedOrders([]);
    const params = new URLSearchParams({ date, limit: '100' });
    if (statusFilter) params.set('status', statusFilter);
    api.get(`/orders/admin/list?${params}`)
      .then((res) => setOrders(res.data.data.orders))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadOrders(); }, [date, statusFilter]);

  async function markDelivered(orderId) {
    try {
      await api.put(`/orders/admin/${orderId}/status`, { status: 'delivered' });
      loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  async function markSelectedDelivered() {
    if (!selectedOrders.length) return;
    if (!window.confirm(`Mark ${selectedOrders.length} orders as delivered?`)) return;
    setLoading(true);
    try {
      await Promise.all(
        selectedOrders.map((id) => api.put(`/orders/admin/${id}/status`, { status: 'delivered' }))
      );
      setSelectedOrders([]);
      loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update some orders');
      loadOrders();
    }
  }

  function switchTab(tab) {
    setActiveTab(tab);
    setSelectedOrders([]);
  }

  const milkOrders = orders.filter((o) => o.milk);
  const productOrders = orders.filter((o) => getExtras(o).length > 0);
  const visibleOrders = activeTab === 'milk' ? milkOrders : productOrders;
  const milkLitres = milkOrders.reduce((sum, o) => sum + (Number(o.milk?.quantity_litres) || 0), 0);
  const productUnits = productOrders.reduce((sum, o) => sum + getExtrasQuantity(o), 0);
  const today = relativeDate(0);
  const canMarkDelivered = date <= today;
  const pendingOrders = visibleOrders.filter((o) => o.status === 'pending' && canMarkDelivered);
  const counts = visibleOrders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
  const activeLabel = activeTab === 'milk' ? 'milk deliveries' : 'product orders';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Orders</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {visibleOrders.length} {activeLabel} - {date}
          </p>
        </div>
        {selectedOrders.length > 0 && canMarkDelivered && (
          <button onClick={markSelectedDelivered} className="btn-primary btn-sm animate-fade-in shrink-0">
            <CheckSquare size={14} />
            Mark {selectedOrders.length} Delivered
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setDate(today)}
          className={`btn-sm ${date === today ? 'btn-primary' : 'btn-ghost'}`}
        >
          Today
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input w-auto flex-1 sm:flex-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select w-36 flex-1 sm:flex-none"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-1 flex gap-1">
        {ORDER_TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          const count = key === 'milk' ? milkOrders.length : productOrders.length;
          const detail = key === 'milk' ? `${milkLitres}L` : `${productUnits} units`;

          return (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon size={15} />
              <span className="truncate">{label}</span>
              <span className={`hidden sm:inline text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {count} / {detail}
              </span>
            </button>
          );
        })}
      </div>

      {!loading && visibleOrders.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'pending', label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
            { key: 'delivered', label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { key: 'cancelled', label: 'Cancelled', cls: 'bg-red-50 text-red-600 border-red-200' },
          ].map(({ key, label, cls }) => counts[key] ? (
            <span key={key} className={`badge border ${cls}`}>
              {STATUS_ICON[key]}
              <span className="ml-1">{counts[key]} {label}</span>
            </span>
          ) : null)}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card h-16 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={Clock} message={`No orders found for ${date}`} />
      ) : visibleOrders.length === 0 ? (
        <EmptyState
          icon={activeTab === 'milk' ? Milk : Package}
          message={`No ${activeTab === 'milk' ? 'subscription milk' : 'product'} deliveries found for ${date}`}
        />
      ) : (
        <>
          <div className="space-y-2 sm:hidden">
            {visibleOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                activeTab={activeTab}
                selected={selectedOrders.includes(order.id)}
                canMarkDelivered={canMarkDelivered}
                onSelect={(checked) => setSelectedOrders(
                  checked
                    ? [...selectedOrders, order.id]
                    : selectedOrders.filter((id) => id !== order.id)
                )}
                onDelivered={() => markDelivered(order.id)}
              />
            ))}
          </div>

          <div className="card overflow-hidden hidden sm:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10 text-center">
                    <input
                      type="checkbox"
                      checked={pendingOrders.length > 0 && selectedOrders.length === pendingOrders.length}
                      onChange={(e) => setSelectedOrders(e.target.checked ? pendingOrders.map((o) => o.id) : [])}
                      disabled={pendingOrders.length === 0}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th>User</th>
                  <th>{activeTab === 'milk' ? 'Milk' : 'Products'}</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    activeTab={activeTab}
                    selected={selectedOrders.includes(order.id)}
                    canMarkDelivered={canMarkDelivered}
                    onSelect={(checked) => setSelectedOrders(
                      checked
                        ? [...selectedOrders, order.id]
                        : selectedOrders.filter((id) => id !== order.id)
                    )}
                    onDelivered={() => markDelivered(order.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
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

function CustomerBlock({ order }) {
  const fallback = order.user_id ? `${order.user_id.slice(0, 10)}...` : 'Unknown';

  return (
    <div>
      <p className="font-semibold text-slate-800 text-sm">
        {order.user_name || order.user_phone || (
          <span className="text-slate-400 italic font-normal text-xs">Unknown</span>
        )}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">
        {order.user_name ? (order.user_phone || fallback) : fallback}
      </p>
      {order.user_address?.line1 && (
        <p className="text-xs text-slate-400 truncate max-w-[160px]" title={order.user_address.line1}>
          {order.user_address.line1}
        </p>
      )}
    </div>
  );
}

function DeliveryDetails({ order, activeTab }) {
  if (activeTab === 'milk') {
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
          Milk Subscription
        </p>
        <span className="font-medium capitalize">
          {order.milk.milk_type} <span className="text-slate-400">{order.milk.quantity_litres}L</span>
        </span>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
        Extra Items
      </p>
      <ul className="space-y-0.5">
        {getExtras(order).map((item, idx) => (
          <li key={idx} className="text-xs text-slate-600">
            {item.name || item.product_name || item.product_id}
            {item.quantity ? ` x ${item.quantity}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`${STATUS_BADGE[status] || 'badge badge-gray'} flex items-center gap-1 w-fit`}>
      {STATUS_ICON[status]}
      {status}
    </span>
  );
}

function OrderCard({ order, activeTab, selected, canMarkDelivered, onSelect, onDelivered }) {
  return (
    <div className={`card p-4 ${selected ? 'ring-2 ring-blue-300' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {order.status === 'pending' && canMarkDelivered && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-blue-600"
            />
          )}
          <div className="min-w-0">
            <CustomerBlock order={order} />
            <div className="mt-1.5">
              <DeliveryDetails order={order} activeTab={activeTab} />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={order.status} />
          <span className="text-sm font-bold text-slate-800">
            {money(getDisplayAmount(order, activeTab))}
          </span>
        </div>
      </div>
      {order.status === 'pending' && canMarkDelivered && (
        <button
          onClick={onDelivered}
          className="btn btn-sm bg-emerald-600 text-white w-full justify-center mt-3"
        >
          <CheckCircle2 size={13} />
          Mark Delivered
        </button>
      )}
    </div>
  );
}

function OrderRow({ order, activeTab, selected, canMarkDelivered, onSelect, onDelivered }) {
  return (
    <tr className={selected ? 'bg-blue-50/60' : ''}>
      <td className="text-center">
        {order.status === 'pending' && canMarkDelivered && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="rounded border-slate-300 w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
        )}
      </td>
      <td>
        <CustomerBlock order={order} />
      </td>
      <td className="text-slate-700">
        <DeliveryDetails order={order} activeTab={activeTab} />
      </td>
      <td className="font-semibold text-slate-800">
        {money(getDisplayAmount(order, activeTab))}
      </td>
      <td>
        <StatusBadge status={order.status} />
      </td>
      <td>
        {order.status === 'pending' && canMarkDelivered && (
          <button
            onClick={onDelivered}
            className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <CheckCircle2 size={13} />
            Delivered
          </button>
        )}
      </td>
    </tr>
  );
}
