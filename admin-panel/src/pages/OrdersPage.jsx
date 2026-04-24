import { useState, useEffect } from 'react';
import api from '../services/api';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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
    if (selectedOrders.length === 0) return;
    try {
      if (!window.confirm(`Mark ${selectedOrders.length} orders as delivered?`)) return;
      setLoading(true);
      await Promise.all(
        selectedOrders.map(id => api.put(`/orders/admin/${id}/status`, { status: 'delivered' }))
      );
      setSelectedOrders([]);
      loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update some orders');
      loadOrders(); // reload to sync state
    }
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Orders</h2>

      <div className="flex gap-3 mb-4 items-center">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        
        {selectedOrders.length > 0 && (
          <button 
            onClick={markSelectedDelivered}
            className="ml-auto bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            Mark {selectedOrders.length} Delivered
          </button>
        )}
      </div>

      {loading ? <p className="text-gray-500">Loading...</p> : orders.length === 0 ? (
        <p className="text-gray-500">No orders found for {date}.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={pendingOrders.length > 0 && selectedOrders.length === pendingOrders.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrders(pendingOrders.map(o => o.id));
                      } else {
                        setSelectedOrders([]);
                      }
                    }}
                    disabled={pendingOrders.length === 0}
                    className="rounded border-gray-300 focus:ring-green-500 text-green-600"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Milk</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Extras</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className={`hover:bg-gray-50 ${selectedOrders.includes(o.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3 text-center">
                    {o.status === 'pending' && (
                      <input 
                        type="checkbox"
                        checked={selectedOrders.includes(o.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrders([...selectedOrders, o.id]);
                          } else {
                            setSelectedOrders(selectedOrders.filter(id => id !== o.id));
                          }
                        }}
                        className="rounded border-gray-300 w-4 h-4 text-green-600 focus:ring-green-500"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{o.user_id?.slice(0, 12)}...</td>
                  <td className="px-4 py-3">
                    {o.milk ? `${o.milk.milk_type} ${o.milk.quantity_litres}L` : '-'}
                  </td>
                  <td className="px-4 py-3">{o.extra_items?.length || 0} items</td>
                  <td className="px-4 py-3 font-medium">₹{o.total_amount?.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      o.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      o.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {o.status === 'pending' && (
                      <button onClick={() => markDelivered(o.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                        Mark Delivered
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
