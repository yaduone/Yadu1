import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Users, Droplets, TrendingUp, ShoppingCart, RefreshCw, Package, Milk } from 'lucide-react';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const STAT_CONFIG = [
  { key: 'active_subscriptions', label: 'Active Subs',     icon: Users,       color: 'blue'    },
  { key: 'tomorrow_total_litres', label: "Tomorrow's L",   icon: Droplets,    color: 'emerald',  format: (v) => `${v}L` },
  { key: 'tomorrow_order_count',  label: 'Orders',         icon: ShoppingCart, color: 'amber'  },
  { key: 'revenue_this_month',    label: 'Revenue / Mo',   icon: TrendingUp,  color: 'purple',   format: (v) => `₹${v?.toLocaleString('en-IN')}` },
];
STAT_CONFIG.forEach((s) => { if (!s.format) s.format = (v) => v; });

const COLOR_MAP = {
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    ring: 'ring-blue-100'    },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-100' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   ring: 'ring-amber-100'   },
  purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600',  ring: 'ring-purple-100'  },
};

const MILK_LABELS = { cow: 'Cow', buffalo: 'Buffalo', toned: 'Child Pack' };
const MILK_TYPE_COLORS = {
  cow:     'text-amber-700 bg-amber-50 ring-amber-100',
  buffalo: 'text-blue-700 bg-blue-50 ring-blue-100',
  toned:   'text-emerald-700 bg-emerald-50 ring-emerald-100',
};

function StatCard({ label, value, icon: Icon, color }) {
  const c = COLOR_MAP[color];
  return (
    <div className="card p-3 sm:p-5 flex items-center gap-2.5 sm:gap-4 animate-fade-in min-w-0">
      <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center shrink-0`}>
        <Icon size={18} className={c.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wide leading-tight truncate">{label}</p>
        <p className="text-lg sm:text-2xl font-bold text-slate-800 mt-0.5 leading-none truncate">{value}</p>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-slate-700 mb-1 text-xs">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium text-xs">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

function DeliverySnapshot({ snapshot, loading }) {
  if (loading) return <div className="card p-5 animate-pulse bg-slate-50 h-40" />;
  if (!snapshot) return null;

  const dateLabel = new Date(snapshot.target_date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  const milkEntries = Object.entries(snapshot.milk_type_breakdown).filter(([, qty]) => qty > 0);

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      {/* Header — stack on xs, row on sm+ */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-700">Delivery Snapshot</p>
            {snapshot.is_past_cutoff && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 shrink-0">
                Past Cutoff
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {snapshot.is_past_cutoff ? 'Day after tomorrow' : 'Tomorrow'} · {dateLabel}
          </p>
        </div>
        <div className="flex items-baseline gap-2 sm:text-right sm:block">
          <p className="text-2xl font-bold text-slate-800 leading-none">{snapshot.total_milk_litres}L</p>
          <p className="text-xs text-slate-400 sm:mt-0.5">{snapshot.total_deliveries} deliveries</p>
        </div>
      </div>

      {/* Milk type breakdown */}
      {milkEntries.length > 0 && (
        <div className={`grid gap-2 ${milkEntries.length === 1 ? 'grid-cols-1' : milkEntries.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {milkEntries.map(([type, qty]) => {
            const cls = MILK_TYPE_COLORS[type] || 'text-slate-700 bg-slate-50 ring-slate-100';
            return (
              <div key={type} className={`rounded-xl p-2.5 sm:p-3 ring-1 ${cls}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Milk size={12} className="shrink-0" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 truncate">
                    {MILK_LABELS[type] || type}
                  </p>
                </div>
                <p className="text-base sm:text-lg font-bold">{qty}L</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Extra items */}
      {snapshot.extra_items.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Extra Items</p>
            <span className="text-xs font-bold text-blue-600">{snapshot.total_extra_quantity} units</span>
          </div>
          <div className="divide-y divide-slate-50">
            {snapshot.extra_items.map((item) => (
              <div key={item.product_name} className="flex items-center justify-between py-1.5 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Package size={12} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{item.product_name}</span>
                  {item.unit && (
                    <span className="text-xs text-slate-400 shrink-0 hidden xs:inline">({item.unit})</span>
                  )}
                </div>
                <span className="text-sm font-bold text-slate-800 shrink-0">×{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">No extra items added to carts yet.</p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData]         = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    if (!silent) { setLoading(true); setSnapshotLoading(true); }
    else setRefreshing(true);
    try {
      const [dashRes, snapRes] = await Promise.all([
        api.get('/reports/admin/dashboard'),
        api.get('/cart/admin/summary'),
      ]);
      setData(dashRes.data.data);
      setSnapshot(snapRes.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setSnapshotLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-8 w-40 rounded-lg bg-slate-100 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4 h-20 sm:h-24 animate-pulse bg-slate-50" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="card p-5 h-56 sm:h-72 animate-pulse bg-slate-50" />
          ))}
        </div>
        <div className="card p-5 h-40 animate-pulse bg-slate-50" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-4 h-20 animate-pulse bg-slate-50" />
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
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="page-title">Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{today}</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn-ghost btn-sm flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Stat cards — 2 col on mobile, 4 col on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {STAT_CONFIG.map(({ key, label, icon, color, format }) => (
          <StatCard key={key} label={label} value={format(data[key])} icon={icon} color={color} />
        ))}
      </div>

      {/* Charts — 1 col on mobile, 2 col on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {milkData.length > 0 && (
          <div className="card p-4 sm:p-5">
            <p className="text-sm font-semibold text-slate-700 mb-0.5">Milk Type Breakdown</p>
            <p className="text-xs text-slate-400 mb-3 sm:mb-4">Tomorrow's delivery in litres</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={milkData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {milkData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconSize={10}
                  formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {data.product_demand.length > 0 && (
          <div className="card p-4 sm:p-5">
            <p className="text-sm font-semibold text-slate-700 mb-0.5">Product Demand</p>
            <p className="text-xs text-slate-400 mb-3 sm:mb-4">Tomorrow's extra item orders</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.product_demand.slice(0, 6)} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="product"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  angle={-25}
                  textAnchor="end"
                  height={48}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="quantity" name="Qty" fill="#3b82f6" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Delivery Snapshot */}
      <DeliverySnapshot snapshot={snapshot} loading={snapshotLoading} />

      {/* Summary row — 1 col on xs, 3 col on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Total Users',          value: data.total_users,          color: 'text-slate-800' },
          { label: 'Paused',               value: data.paused_subscriptions, color: 'text-amber-600' },
          { label: 'Extra Products Ordered', value: data.product_demand.reduce((s, p) => s + p.quantity, 0), color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 sm:p-5 flex sm:block items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide leading-tight">{label}</p>
            <p className={`text-2xl sm:text-3xl font-bold sm:mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
