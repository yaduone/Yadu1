import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { BarChart3, Droplets, TrendingUp, Calendar } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-600 mb-1 text-xs">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name === 'amount' ? `₹${p.value?.toFixed(2)}` : p.value}
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const [stats, setStats]     = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo]     = useState(today);

  function loadStats() {
    setLoading(true);
    api.get(`/reports/admin/daily?from=${from}&to=${to}`)
      .then((res) => setStats(res.data.data.stats))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadStats(); }, [from, to]);

  const totalOrders  = stats.reduce((s, d) => s + d.orders, 0);
  const totalLitres  = stats.reduce((s, d) => s + d.milk_litres, 0);
  const totalRevenue = stats.reduce((s, d) => s + d.amount, 0);

  const summaryCards = [
    { label: 'Total Orders',  value: totalOrders,   icon: BarChart3,  color: 'blue',    format: (v) => v },
    { label: 'Milk (L)',      value: totalLitres,   icon: Droplets,   color: 'emerald', format: (v) => `${v}L` },
    { label: 'Revenue',       value: totalRevenue,  icon: TrendingUp, color: 'purple',  format: (v) => `₹${v.toFixed(0)}` },
  ];

  const colorMap = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-100'    },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  ring: 'ring-purple-100'  },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Reports</h2>
          <p className="text-xs text-slate-400 mt-0.5">Daily performance overview</p>
        </div>
        {/* Date range — stacks on mobile */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={15} className="text-slate-400 hidden sm:block shrink-0" />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input w-full sm:w-auto text-xs"
          />
          <span className="text-slate-400 text-xs shrink-0">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input w-full sm:w-auto text-xs"
          />
        </div>
      </div>

      {/* Summary cards — 1 col on mobile, 3 on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {summaryCards.map(({ label, value, icon: Icon, color, format }) => {
          const c = colorMap[color];
          return (
            <div key={label} className="card p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-2xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center shrink-0`}>
                <Icon size={20} className={c.text} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-0.5 truncate">{format(value)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card p-5 h-64 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : stats.length === 0 ? (
        <div className="card p-16 text-center">
          <BarChart3 size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No data for this period</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Daily Orders */}
          <div className="card p-4 sm:p-5">
            <p className="text-sm font-semibold text-slate-700 mb-0.5">Daily Orders</p>
            <p className="text-xs text-slate-400 mb-4">Order count per day</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} fill="url(#ordersGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Revenue */}
          <div className="card p-4 sm:p-5">
            <p className="text-sm font-semibold text-slate-700 mb-0.5">Daily Revenue</p>
            <p className="text-xs text-slate-400 mb-4">Revenue in ₹ per day</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
