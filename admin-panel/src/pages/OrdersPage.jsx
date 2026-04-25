import { useState, useEffect } from 'react';
import api from '../services/api';
import { CheckCircle2, Clock, XCircle, CheckSquare } from 'lucide-react';

const STATUS_BADGE = {
  delivered: 'badge badge-green',
  pending:   'badge badge-yellow',
  cancelled: 'badge badge-red',
};

const STATUS_ICON = {
  delivered: <CheckCircle2 size={13} className="text-emerald-500" />,
  pending:   <Clock size={13} className="text-amber-500" />,
  cancelled: <XCircle size={13} className="text-red-400" />,
};

export default function OrdersPage() {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [date, setDate]               = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrders, setSelectedOrders] = useState([]);

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

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const counts = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Orders</h2>
          <p className="text-xs text-slate-400 mt-0.5">{orders.length} orders for {date}</p>
        </div>
        {selectedOrders.length > 0 && (
          <button onClick={markSelectedDelivered} className="btn-primary animate-fade-in">
            <CheckSquare size={15} />
            Mark {selectedOrders.length} Delivered
          </button>
        )}
      </div>

      {/* Summary pills */}
      {!loading && orders.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'pending',   label: 'Pending',   cls: 'bg-amber-50 text-amber-700 border-amber-200'   },
            { key: 'delivered', label: 'Delivered',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { key: 'cancelled', label: 'Cancelled',  cls: 'bg-red-50 text-red-600 border-red-200'         },
          ].map(({ key, label, cls }) => counts[key] ? (
            <span key={key} className={`badge border ${cls}`}>
              {STATUS_ICON[key]}
              <span className="ml-1">{counts[key]} {label}</span>
            </span>
          ) : null)}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input w-auto"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select w-40"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card h-14 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-16 text-center">
          <Clock size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No orders found for {date}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
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
                <th>Milk</th>
                <th>Extras</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className={selectedOrders.includes(o.id) ? 'bg-blue-50/60' : ''}>
                  <td className="text-center">
                    {o.status === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(o.id)}
                        onChange={(e) => setSelectedOrders(
                          e.target.checked
                            ? [...selectedOrders, o.id]
                            : selectedOrders.filter((id) => id !== o.id)
                        )}
                        className="rounded border-slate-300 w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                    )}
                  </td>
                  <td className="font-mono text-xs text-slate-500">{o.user_id?.slice(0, 12)}…</td>
                  <td className="text-slate-700">
                    {o.milk ? (
                      <span className="font-medium capitalize">{o.milk.milk_type} <span className="text-slate-400">{o.milk.quantity_litres}L</span></span>
                    ) : '—'}
                  </td>
                  <td>
                    {o.extra_items?.length > 0 ? (
                      <span className="badge badge-blue">{o.extra_items.length} items</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="font-semibold text-slate-800">₹{o.total_amount?.toFixed(2)}</td>
                  <td>
                    <span className={`${STATUS_BADGE[o.status] || 'badge badge-gray'} flex items-center gap-1 w-fit`}>
                      {STATUS_ICON[o.status]}
                      {o.status}
                    </span>
                  </td>
                  <td>
                    {o.status === 'pending' && (
                      <button
                        onClick={() => markDelivered(o.id)}
                        className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-400"
                      >
                        <CheckCircle2 size={13} />
                        Delivered
                      </button>
                    )}
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
