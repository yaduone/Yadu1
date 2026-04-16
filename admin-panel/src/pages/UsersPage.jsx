import { useState, useEffect } from 'react';
import api from '../services/api';

const STATUS_STYLES = {
  active:    'bg-green-100 text-green-700',
  paused:    'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

const MILK_LABELS = { cow: 'Cow', buffalo: 'Buffalo', toned: 'Toned' };

export default function UsersPage() {
  const [users, setUsers]     = useState([]);
  const [dueMap, setDueMap]   = useState({}); // userId → due_amount
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all'); // all | active | paused | cancelled | no_sub

  useEffect(() => {
    Promise.all([
      api.get('/users/admin/list'),
      api.get('/dues/admin/list'),
    ])
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

  // Summary counts
  const counts = users.reduce((acc, u) => {
    const s = u.subscription?.status ?? 'no_sub';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Users</h2>
        <span className="text-sm text-gray-500">{users.length} total in your area</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active',      key: 'active',    color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Paused',      key: 'paused',    color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Cancelled',   key: 'cancelled', color: 'text-red-600',    bg: 'bg-red-50'    },
          { label: 'No Sub',      key: 'no_sub',    color: 'text-gray-500',   bg: 'bg-gray-50'   },
        ].map(({ label, key, color, bg }) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={`${bg} rounded-xl p-4 text-left border-2 transition-all ${
              filter === key ? 'border-gray-400' : 'border-transparent'
            }`}
          >
            <p className={`text-2xl font-bold ${color}`}>{counts[key] || 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, phone or address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_sub">No Subscription</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 py-10 text-center">Loading users…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 py-10 text-center">No users found.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Address</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Milk</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Qty / Day</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">₹ / Day</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Since</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Due</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((user) => {
                const sub = user.subscription;
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    {/* User */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{user.name || <span className="text-gray-400 italic">Incomplete</span>}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{user.id.slice(0, 10)}…</p>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{user.phone || '—'}</td>

                    {/* Address */}
                    <td className="px-4 py-3 text-gray-600 max-w-[180px]">
                      {user.address ? (
                        <span title={`${user.address.line1}, ${user.address.pincode}`}>
                          {user.address.line1}
                          {user.address.pincode && <span className="text-gray-400 ml-1">· {user.address.pincode}</span>}
                        </span>
                      ) : '—'}
                    </td>

                    {/* Milk type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {sub ? (
                        <span className="capitalize font-medium text-gray-700">
                          {MILK_LABELS[sub.milk_type] || sub.milk_type}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {sub ? `${sub.quantity_litres} L` : <span className="text-gray-300">—</span>}
                    </td>

                    {/* Daily value */}
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {sub ? `₹${sub.daily_value}` : <span className="text-gray-300">—</span>}
                    </td>

                    {/* Start date */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {sub?.start_date || <span className="text-gray-300">—</span>}
                    </td>

                    {/* Due amount */}
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {(() => {
                        const due = dueMap[user.id] ?? null;
                        if (due === null) return <span className="text-gray-300">—</span>;
                        return (
                          <span className={`font-bold text-sm ${due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ₹{due.toFixed(2)}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {sub ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                          {sub.status}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                          no sub
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
