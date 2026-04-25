import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Users, Droplets, TrendingUp, ShoppingCart, RefreshCw } from 'lucide-react';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const STAT_CONFIG = [
  {
    key: 'active_subscriptions',
    label: 'Active Subscriptions',
    icon: Users,
    color: 'blue',
    format: (v) => v,
  },
  {
    key: 'tomorrow_total_litres',
    label: "Tomorrow's Litres",
    icon: Droplets,
    color: 'emerald',
    format: (v) => `${v}L`,
  },
  {
    key: 'tomorrow_order_count',
    label: "Tomorrow's Orders",
    icon: ShoppingCart,
    color: 'amber',
    format: (v) => v,
  },
  {
    key: 'revenue_this_month',
    label: 'Revenue (Month)',
    icon: TrendingUp,
    color: 'purple',
    format: (v) => `₹${v?.toLocaleString('en-IN')}`,
  },
];

const COLOR_MAP = {
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    ring: 'ring-blue-100'    },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-100' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   ring: 'ring-amber-100'   },
  purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600',  ring: 'ring-purple-100'  },
};

function StatCard({ label, value, icon: Icon, color }) {
  const c = COLOR_MAP[color];
  return (
    <div className="card p-5 flex items-center gap-4 animate-fade-in">
      <div className={`w-12 h-12 rounded-2xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center shrink-0`}>
        <Icon size={22} className={c.icon} />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5 leading-none">{value}</p>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get('/reports/admin/dashboard');
      setData(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h2 className="page-title">Dashboard</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 h-24 animate-pulse bg-slate-50" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card p-5 h-72 animate-pulse bg-slate-50" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-12 text-center text-slate-500">
        Failed to load dashboard data.
      </div>
    );
  }

  const milkData = Object.entries(data.milk_type_breakdown)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5">{today}</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn-ghost btn-sm flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CONFIG.map(({ key, label, icon, color, format }) => (
          <StatCard
            key={key}
            label={label}
            value={format(data[key])}
            icon={icon}
            color={color}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Milk breakdown */}
        {milkData.length > 0 && (
          <div className="card p-5">
            <p className="text-sm font-semibold text-slate-700 mb-1">Milk Type Breakdown</p>
            <p className="text-xs text-slate-400 mb-4">Tomorrow's delivery in litres</p>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={milkData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {milkData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-slate-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Product demand */}
        {data.product_demand.length > 0 && (
          <div className="card p-5">
            <p className="text-sm font-semibold text-slate-700 mb-1">Product Demand</p>
            <p className="text-xs text-slate-400 mb-4">Tomorrow's extra item orders</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.product_demand.slice(0, 8)} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="product"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  angle={-20}
                  textAnchor="end"
                  height={52}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="quantity" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Users',             value: data.total_users,            color: 'text-slate-800' },
          { label: 'Paused Subscriptions',    value: data.paused_subscriptions,   color: 'text-amber-600' },
          { label: 'Extra Products Ordered',  value: data.product_demand.reduce((s, p) => s + p.quantity, 0), color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
