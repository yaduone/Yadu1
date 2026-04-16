import { useState, useEffect } from 'react';
import api from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, Milk, TrendingUp, ShoppingCart } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/admin/dashboard')
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (!data) return <div className="text-red-500">Failed to load dashboard</div>;

  const milkData = Object.entries(data.milk_type_breakdown)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  const stats = [
    { label: 'Active Subscriptions', value: data.active_subscriptions, icon: Users, color: 'blue' },
    { label: 'Tomorrow Litres', value: `${data.tomorrow_total_litres}L`, icon: Milk, color: 'green' },
    { label: 'Tomorrow Orders', value: data.tomorrow_order_count, icon: ShoppingCart, color: 'amber' },
    { label: 'Revenue (Month)', value: `₹${data.revenue_this_month.toLocaleString()}`, icon: TrendingUp, color: 'purple' },
  ];

  const colorMap = { blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700', purple: 'bg-purple-50 text-purple-700' };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Dashboard</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
              </div>
              <div className={`p-3 rounded-lg ${colorMap[color]}`}>
                <Icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milk Type Breakdown */}
        {milkData.length > 0 && (
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Tomorrow Milk Breakdown (Litres)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={milkData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}L`}>
                  {milkData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Product Demand */}
        {data.product_demand.length > 0 && (
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Tomorrow Product Demand</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.product_demand.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="product" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="text-2xl font-bold text-gray-800">{data.total_users}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Paused Subscriptions</p>
          <p className="text-2xl font-bold text-gray-800">{data.paused_subscriptions}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Extra Products Ordered</p>
          <p className="text-2xl font-bold text-gray-800">
            {data.product_demand.reduce((s, p) => s + p.quantity, 0)}
          </p>
        </div>
      </div>
    </div>
  );
}
