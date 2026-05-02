import { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Users, UserCheck, UserX, UserMinus, HelpCircle } from 'lucide-react';

const STATUS_BADGE = {
  active:    'badge badge-green',
  paused:    'badge badge-yellow',
  cancelled: 'badge badge-red',
};

const MILK_LABELS = { cow: 'Cow', buffalo: 'Buffalo', toned: 'Child Pack' };

const FILTER_CONFIG = [
  { key: 'active',    label: 'Active',    icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'paused',    label: 'Paused',    icon: UserMinus, color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200'   },
  { key: 'cancelled', label: 'Cancelled', icon: UserX,     color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200'     },
  { key: 'no_sub',    label: 'No Sub',    icon: HelpCircle,color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200'   },
];

export default function UsersPage() {
  const [users, setUsers]     = useState([]);
  const [dueMap, setDueMap]   = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');

  useEffect(() => {
    Promise.all([api.get('/users/admin/list'), api.get('/dues/admin/list')])
      .then(([usersRes, duesRes]) => {
        setUsers(usersRes.data.data.users);
        const map = {};
        (duesRes.data.data.dues || []).forEach((d) => { map[d.user_id || d.id] = d.due_amount || 0; });
        setDueMap(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) => {
    const subStatus = u.subscription?.status ?? 'no_sub';
    if (filter !== 'all' && subStatus !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        u.address?.line1?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = users.reduce((acc, u) => {
    const s = u.subscription?.status ?? 'no_sub';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="page-title">Users</h2>
        <p className="text-xs text-slate-400 mt-0.5">{users.length} total in your area</p>
      </div>

      {/* Summary filter cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {FILTER_CONFIG.map(({ key, label, icon: Icon, color, bg, border }) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={`${bg} rounded-2xl p-3 sm:p-4 text-left border-2 transition-all ${
              filter === key ? `${border} shadow-sm` : 'border-transparent'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Icon size={15} className={color} />
              {filter === key && <span className="text-[9px] font-bold text-slate-400 uppercase">Active</span>}
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${color}`}>{counts[key] || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="select w-32 sm:w-40"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_sub">No Sub</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-16 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Users size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No users found</p>
          <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="space-y-2 sm:hidden">
            {filtered.map((user) => {
              const sub = user.subscription;
              const due = dueMap[user.id] ?? null;
              return (
                <div key={user.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-sm font-bold">
                        {user.name ? user.name[0].toUpperCase() : '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-800 text-sm truncate">
                          {user.name || <span className="text-slate-400 italic font-normal">Incomplete</span>}
                        </p>
                        {sub ? (
                          <span className={STATUS_BADGE[sub.status] || 'badge badge-gray'}>
                            {sub.status}
                          </span>
                        ) : (
                          <span className="badge badge-gray">no sub</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{user.phone || '—'}</p>
                      {user.address && (
                        <p className="text-xs text-slate-400 truncate">{user.address.line1}</p>
                      )}
                      {sub && (
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-xs text-slate-600 font-medium capitalize">
                            {MILK_LABELS[sub.milk_type] || sub.milk_type} · {sub.quantity_litres}L
                          </span>
                          <span className="text-xs font-semibold text-slate-700">₹{sub.daily_value}/day</span>
                          {due !== null && (
                            <span className={`text-xs font-bold ${due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              Due: ₹{due.toFixed(0)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="card overflow-x-auto hidden sm:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Milk</th>
                  <th>Qty / Day</th>
                  <th>₹ / Day</th>
                  <th>Since</th>
                  <th className="text-right">Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const sub = user.subscription;
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
                            <span className="text-white text-xs font-bold">
                              {user.name ? user.name[0].toUpperCase() : '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">
                              {user.name || <span className="text-slate-400 italic font-normal">Incomplete</span>}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">{user.id.slice(0, 10)}…</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-600 whitespace-nowrap">{user.phone || '—'}</td>
                      <td className="text-slate-500 max-w-[160px]">
                        {user.address ? (
                          <span title={`${user.address.line1}, ${user.address.pincode}`} className="truncate block">
                            {user.address.line1}
                            {user.address.pincode && <span className="text-slate-400 ml-1">· {user.address.pincode}</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="whitespace-nowrap">
                        {sub ? (
                          <span className="font-medium text-slate-700 capitalize">
                            {MILK_LABELS[sub.milk_type] || sub.milk_type}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap text-slate-600">
                        {sub ? `${sub.quantity_litres} L` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap font-semibold text-slate-700">
                        {sub ? `₹${sub.daily_value}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap text-slate-500 text-xs">
                        {sub?.start_date || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        {(() => {
                          const due = dueMap[user.id] ?? null;
                          if (due === null) return <span className="text-slate-300">—</span>;
                          return (
                            <span className={`font-bold text-sm ${due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              ₹{due.toFixed(2)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="whitespace-nowrap">
                        {sub ? (
                          <span className={STATUS_BADGE[sub.status] || 'badge badge-gray'}>
                            {sub.status}
                          </span>
                        ) : (
                          <span className="badge badge-gray">no sub</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
