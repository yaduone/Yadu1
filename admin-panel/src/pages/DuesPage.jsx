import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const METHOD_LABELS = { cash: 'Cash', upi: 'UPI', other: 'Other' };
const METHOD_COLORS = { cash: 'bg-green-100 text-green-700', upi: 'bg-blue-100 text-blue-700', other: 'bg-gray-100 text-gray-600' };
const TICKET_STATUS_COLORS = { open: 'bg-red-100 text-red-700', in_review: 'bg-yellow-100 text-yellow-700', resolved: 'bg-green-100 text-green-700' };

export default function DuesPage() {
  const [tab, setTab] = useState('dues'); // 'dues' | 'tickets'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Dues & Payments</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[['dues', 'Due Amounts'], ['tickets', 'Tickets']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'dues' ? <DuesTab /> : <TicketsTab />}
    </div>
  );
}

// ─── Dues Tab ─────────────────────────────────────────────────────────────────

function DuesTab() {
  const [dues, setDues] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // userId for payment panel
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', notes: '' });
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [duesRes, usersRes] = await Promise.all([
        api.get('/dues/admin/list'),
        api.get('/users/admin/list'),
      ]);
      const dueList = duesRes.data.data.dues;
      const userList = usersRes.data.data.users;
      // Build userId → user map
      const userMap = {};
      userList.forEach((u) => { userMap[u.id] = u; });
      setDues(dueList);
      setUsers(userMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openUser(userId) {
    setSelected(userId);
    setPayForm({ amount: '', method: 'cash', notes: '' });
    setPayError('');
    setLoadingPayments(true);
    try {
      const res = await api.get(`/dues/admin/user/${userId}/payments`);
      setPayments(res.data.data.payments);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPayments(false);
    }
  }

  async function submitPayment(e) {
    e.preventDefault();
    setPayError('');
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) { setPayError('Enter a valid amount'); return; }
    setPaying(true);
    try {
      await api.post('/dues/admin/payment', {
        user_id: selected,
        amount,
        method: payForm.method,
        notes: payForm.notes,
      });
      setPayForm({ amount: '', method: 'cash', notes: '' });
      // Refresh
      const [duesRes, paymentsRes] = await Promise.all([
        api.get('/dues/admin/list'),
        api.get(`/dues/admin/user/${selected}/payments`),
      ]);
      setDues(duesRes.data.data.dues);
      setPayments(paymentsRes.data.data.payments);
    } catch (e) {
      setPayError(e.response?.data?.error || 'Failed to record payment');
    } finally {
      setPaying(false);
    }
  }

  const filtered = dues.filter((d) => {
    if (!search) return true;
    const u = users[d.user_id || d.id];
    const q = search.toLowerCase();
    return (
      u?.name?.toLowerCase().includes(q) ||
      u?.phone?.includes(q)
    );
  });

  // Summary
  const totalDue = dues.reduce((s, d) => s + ((d.due_amount || 0) > 0 ? d.due_amount : 0), 0);
  const totalPrepaid = dues.reduce((s, d) => s + ((d.due_amount || 0) < 0 ? Math.abs(d.due_amount) : 0), 0);
  const totalBilled = dues.reduce((s, d) => s + (d.total_billed || 0), 0);
  const totalPaid = dues.reduce((s, d) => s + (d.total_paid || 0), 0);

  const selectedUser = selected ? users[selected] : null;
  const selectedDue = selected ? dues.find((d) => (d.user_id || d.id) === selected) : null;

  return (
    <div className="flex gap-6">
      {/* Left: table */}
      <div className="flex-1 min-w-0">
        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total Outstanding', value: `₹${totalDue.toFixed(2)}`, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Total Prepaid', value: `+ ₹${totalPrepaid.toFixed(2)}`, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Total Billed', value: `₹${totalBilled.toFixed(2)}`, color: 'text-gray-700', bg: 'bg-gray-50' },
            { label: 'Total Collected', value: `₹${totalPaid.toFixed(2)}`, color: 'text-green-700', bg: 'bg-green-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-4`}>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 uppercase tracking-wide font-semibold">{label}</p>
            </div>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        {loading ? (
          <p className="text-gray-500 text-center py-10">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No due records found.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Billed</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Paid</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Due</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((d) => {
                  const uid = d.user_id || d.id;
                  const u = users[uid];
                  const isSelected = selected === uid;
                  return (
                    <tr
                      key={uid}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      onClick={() => openUser(uid)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{u?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{u?.phone || uid.slice(0, 10) + '…'}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">₹{(d.total_billed || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">₹{(d.total_paid || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold text-base ${(d.due_amount || 0) > 0 ? 'text-red-600' : (d.due_amount || 0) < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                          {(d.due_amount || 0) < 0 ? `+ ₹${Math.abs(d.due_amount).toFixed(2)}` : `₹${(d.due_amount || 0).toFixed(2)}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-xs text-blue-600 hover:underline font-medium">
                          {isSelected ? 'Close' : 'Manage'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right: payment panel */}
      {selected && (
        <div className="w-80 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-0">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-800">{selectedUser?.name || 'User'}</h3>
                <p className="text-xs text-gray-400">{selectedUser?.phone}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            {/* Due balance */}
            <div className={`rounded-lg p-3 mb-4 ${(selectedDue?.due_amount || 0) > 0 ? 'bg-red-50' : (selectedDue?.due_amount || 0) < 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
              <p className="text-xs text-gray-500">{(selectedDue?.due_amount || 0) < 0 ? 'Prepaid Balance' : 'Outstanding Due'}</p>
              <p className={`text-2xl font-bold mt-0.5 ${(selectedDue?.due_amount || 0) > 0 ? 'text-red-600' : (selectedDue?.due_amount || 0) < 0 ? 'text-green-600' : 'text-gray-800'}`}>
                {(selectedDue?.due_amount || 0) < 0 ? `+ ₹${Math.abs(selectedDue.due_amount).toFixed(2)}` : `₹${(selectedDue?.due_amount || 0).toFixed(2)}`}
              </p>
            </div>

            {/* Record payment form */}
            <form onSubmit={submitPayment} className="mb-5">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Record Payment</p>
              <div className="space-y-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Amount (₹)"
                  value={payForm.amount}
                  onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
                <select
                  value={payForm.method}
                  onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={payForm.notes}
                  onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              {payError && <p className="text-red-600 text-xs mt-2">{payError}</p>}
              <button
                type="submit"
                disabled={paying}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-60"
              >
                {paying ? 'Recording…' : 'Record Payment'}
              </button>
            </form>

            {/* Payment history */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Payment History</p>
              {loadingPayments ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : payments.length === 0 ? (
                <p className="text-xs text-gray-400">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-xs text-gray-500">{p.payment_date}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${METHOD_COLORS[p.method] || 'bg-gray-100'}`}>
                            {METHOD_LABELS[p.method] || p.method}
                          </span>
                          {p.notes && <span className="text-xs text-gray-400 truncate max-w-[90px]" title={p.notes}>{p.notes}</span>}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-green-600">+₹{(p.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tickets Tab ──────────────────────────────────────────────────────────────

function TicketsTab() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [resolveForm, setResolveForm] = useState({ status: '', admin_notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/dues/admin/tickets${statusFilter ? `?status=${statusFilter}` : ''}`);
      setTickets(res.data.data.tickets);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openTicket(t) {
    setSelected(t);
    setResolveForm({ status: t.status, admin_notes: t.admin_notes || '' });
  }

  async function saveTicket(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/dues/admin/tickets/${selected.id}`, resolveForm);
      await load();
      setSelected(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const counts = tickets.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});

  return (
    <div className="flex gap-6">
      {/* List */}
      <div className="flex-1 min-w-0">
        {/* Filter bar */}
        <div className="flex gap-2 mb-4">
          {[['', 'All'], ['open', 'Open'], ['in_review', 'In Review'], ['resolved', 'Resolved']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === val
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label} {val && counts[val] ? `(${counts[val]})` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-10">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No tickets found.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => openTicket(t)}
                className={`bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300 transition-colors ${
                  selected?.id === t.id ? 'border-blue-400 ring-1 ring-blue-400' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{t.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.user_name} · {t.user_phone}</p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{t.description}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${TICKET_STATUS_COLORS[t.status] || 'bg-gray-100'}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
                {t.admin_notes && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500"><span className="font-medium">Admin note:</span> {t.admin_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolve panel */}
      {selected && (
        <div className="w-72 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-0">
            <div className="flex items-start justify-between mb-4">
              <p className="font-bold text-gray-800 text-sm">Update Ticket</p>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">{selected.subject}</p>
            <p className="text-xs text-gray-500 mb-4">{selected.description}</p>

            <form onSubmit={saveTicket} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Status</label>
                <select
                  value={resolveForm.status}
                  onChange={(e) => setResolveForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="open">Open</option>
                  <option value="in_review">In Review</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Admin Notes</label>
                <textarea
                  rows={4}
                  placeholder="Add a note for the user…"
                  value={resolveForm.admin_notes}
                  onChange={(e) => setResolveForm((f) => ({ ...f, admin_notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
