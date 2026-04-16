import { useState, useEffect } from 'react';
import api from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ReportsPage() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);

  function loadStats() {
    setLoading(true);
    api.get(`/reports/admin/daily?from=${from}&to=${to}`)
      .then((res) => setStats(res.data.data.stats))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadStats(); }, [from, to]);

  const totalOrders = stats.reduce((s, d) => s + d.orders, 0);
  const totalLitres = stats.reduce((s, d) => s + d.milk_litres, 0);
  const totalRevenue = stats.reduce((s, d) => s + d.amount, 0);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Reports</h2>

      <div className="flex gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">From:</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">To:</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Total Milk</p>
          <p className="text-2xl font-bold">{totalLitres}L</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold">₹{totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      {loading ? <p className="text-gray-500">Loading...</p> : stats.length === 0 ? (
        <p className="text-gray-500">No data for this period.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Orders</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Revenue (₹)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
