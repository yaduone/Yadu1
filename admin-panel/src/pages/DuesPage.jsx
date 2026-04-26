import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { X, TrendingDown, TrendingUp, Wallet, Receipt, Ticket, Search } from 'lucide-react';

const METHOD_LABELS = { cash: 'Cash', upi: 'UPI', other: 'Other' };
const METHOD_BADGE  = { cash: 'badge badge-green', upi: 'badge badge-blue', other: 'badge badge-gray' };
const TICKET_BADGE  = { open: 'badge badge-red', in_review: 'badge badge-yellow', resolved: 'badge badge-green' };

export default function DuesPage() {
  const [tab, setTab] = useState('dues');

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="page-title">Dues & Payments</h2>
          <p className="text-xs text-slate-400 mt-0.5">Track outstanding balances and support tickets</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 self-start sm:self-auto">
          {[['dues', 'Due Amounts', Wallet], ['tickets', 'Tickets', Ticket]].map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={13} />
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
  const [dues, setDues]                   = useState([]);
  const [users, setUsers]                 = useState({});
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [selected, setSelected]           = useState(null);
  const [payments, setPayments]           = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [payForm, setPayForm]             = useState({ amount: '', method: 'cash', notes: '' });
  const [paying, setPaying]               = useState(false);
  const [payError, setPayError]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [duesRes, usersRes] = await Promise.all([
        api.get('/dues/admin/list'),
        api.get('/users/admin/list'),
      ]);
      const userMap = {};
      usersRes.data.data.users.forEach((u) => { userMap[u.id] = u; });
      setDues(duesRes.data.data.dues);
      setUsers(userMap);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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
    } catch (e) { console.error(e); }
    finally { setLoadingPayments(false); }
  }

  async function submitPayment(e) {
    e.preventDefault();
    setPayError('');
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) { setPayError('Enter a valid amount'); return; }
    setPaying(true);
    try {
      await api.post('/dues/admin/payment', { user_id: selected, amount, method: payForm.method, notes: payForm.notes });
      setPayForm({ amount: '', method: 'cash', notes: '' });
      const [duesRes, paymentsRes] = await Promise.all([
        api.get('/dues/admin/list'),
        api.get(`/dues/admin/user/${selected}/payments`),
      ]);
      setDues(duesRes.data.data.dues);
      setPayments(paymentsRes.data.data.payments);
    } catch (e) {
      setPayError(e.response?.data?.error || 'Failed to record payment');
    } finally { setPaying(false); }
  }

  const filtered = dues.filter((d) => {
    if (!search) return true;
    const u = users[d.user_id || d.id];
    const q = search.toLowerCase();
    return u?.name?.toLowerCase().includes(q) || u?.phone?.includes(q);
  });

  const totalDue     = dues.reduce((s, d) => s + ((d.due_amount || 0) > 0 ? d.due_amount : 0), 0);
  const totalPrepaid = dues.reduce((s, d) => s + ((d.due_amount || 0) < 0 ? Math.abs(d.due_amount) : 0), 0);
  const totalBilled  = dues.reduce((s, d) => s + (d.total_billed || 0), 0);
  const totalPaid    = dues.reduce((s, d) => s + (d.total_paid || 0), 0);

  const selectedUser = selected ? users[selected] : null;
  const selectedDue  = selected ? dues.find((d) => (d.user_id || d.id) === selected) : null;

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      <div className="flex-1 min-w-0 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Outstanding', value: `₹${totalDue.toFixed(2)}`,     color: 'text-red-600',     bg: 'bg-red-50',     icon: TrendingDown },
            { label: 'Prepaid',     value: `+₹${totalPrepaid.toFixed(2)}`, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: TrendingUp   },
            { label: 'Total Billed',value: `₹${totalBilled.toFixed(2)}`,   color: 'text-slate-700',   bg: 'bg-slate-50',   icon: Receipt      },
            { label: 'Collected',   value: `₹${totalPaid.toFixed(2)}`,     color: 'text-emerald-700', bg: 'bg-emerald-50', icon: Wallet       },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} className={`${bg} rounded-2xl p-4`}>
              <Icon size={16} className={`${color} mb-2 opacity-70`} />
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-semibold uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="card h-14 animate-pulse bg-slate-50" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">No due records found.</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th className="text-right">Billed</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const uid = d.user_id || d.id;
                  const u = users[uid];
                  const isSelected = selected === uid;
                  return (
                    <tr
                      key={uid}
                      className={`cursor-pointer ${isSelected ? 'bg-blue-50/60' : ''}`}
                      onClick={() => openUser(uid)}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center shrink-0">
                            <span className="text-white text-xs font-bold">
                              {u?.name ? u.name[0].toUpperCase() : '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{u?.name || 'Unknown'}</p>
                            <p className="text-xs text-slate-400">{u?.phone || uid.slice(0, 10) + '…'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right text-slate-500">₹{(d.total_billed || 0).toFixed(2)}</td>
                      <td className="text-right text-emerald-600 font-medium">₹{(d.total_paid || 0).toFixed(2)}</td>
                      <td className="text-right">
                        <span className={`font-bold ${(d.due_amount || 0) > 0 ? 'text-red-600' : (d.due_amount || 0) < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {(d.due_amount || 0) < 0 ? `+₹${Math.abs(d.due_amount).toFixed(2)}` : `₹${(d.due_amount || 0).toFixed(2)}`}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-blue-600 font-semibold">{isSelected ? 'Close ▲' : 'Manage'}</span>
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
        <div className="w-full lg:w-80 shrink-0 animate-slide-in">
          <div className="card p-5 sticky top-0 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-800">{selectedUser?.name || 'User'}</h3>
                <p className="text-xs text-slate-400">{selectedUser?.phone}</p>
              </div>
              <button onClick={() => setSelected(null)} className="btn-icon">
                <X size={16} />
              </button>
            </div>

            {/* Balance */}
            <div className={`rounded-xl p-3 ${(selectedDue?.due_amount || 0) > 0 ? 'bg-red-50' : (selectedDue?.due_amount || 0) < 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
              <p className="text-xs text-slate-500">{(selectedDue?.due_amount || 0) < 0 ? 'Prepaid Balance' : 'Outstanding Due'}</p>
              <p className={`text-2xl font-bold mt-0.5 ${(selectedDue?.due_amount || 0) > 0 ? 'text-red-600' : (selectedDue?.due_amount || 0) < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                {(selectedDue?.due_amount || 0) < 0 ? `+₹${Math.abs(selectedDue.due_amount).toFixed(2)}` : `₹${(selectedDue?.due_amount || 0).toFixed(2)}`}
              </p>
            </div>

            {/* Payment form */}
            <form onSubmit={submitPayment} className="space-y-2.5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Record Payment</p>
              <input
                type="number" step="0.01" min="0.01" placeholder="Amount (₹)"
                value={payForm.amount}
                onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                className="input" required
              />
              <select
                value={payForm.method}
                onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}
                className="select"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text" placeholder="Notes (optional)"
                value={payForm.notes}
                onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))}
                className="input"
              />
              {payError && <p className="text-red-600 text-xs">{payError}</p>}
              <button type="submit" disabled={paying} className="btn-primary w-full justify-center disabled:opacity-60">
                {paying ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Recording…</>
                ) : 'Record Payment'}
              </button>
            </form>

            {/* History */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Payment History</p>
              {loadingPayments ? (
                <p className="text-xs text-slate-400">Loading…</p>
              ) : payments.length === 0 ? (
                <p className="text-xs text-slate-400">No payments recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-xs text-slate-400">{p.payment_date}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={METHOD_BADGE[p.method] || 'badge badge-gray'}>
                            {METHOD_LABELS[p.method] || p.method}
                          </span>
                          {p.notes && <span className="text-xs text-slate-400 truncate max-w-[80px]" title={p.notes}>{p.notes}</span>}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">+₹{(p.amount || 0).toFixed(2)}</span>
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
  const [tickets, setTickets]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected]     = useState(null);
  const [resolveForm, setResolveForm] = useState({ status: '', admin_notes: '' });
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/dues/admin/tickets${statusFilter ? `?status=${statusFilter}` : ''}`);
      setTickets(res.data.data.tickets);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  const counts = tickets.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      <div className="flex-1 min-w-0 space-y-4">
        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {[['', 'All'], ['open', 'Open'], ['in_review', 'In Review'], ['resolved', 'Resolved']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`btn btn-sm ${statusFilter === val ? 'btn-primary' : 'btn-secondary'}`}
            >
              {label}{val && counts[val] ? ` (${counts[val]})` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-slate-50" />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">No tickets found.</div>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => openTicket(t)}
                className={`card p-4 cursor-pointer hover:border-blue-200 transition-all ${
                  selected?.id === t.id ? 'border-blue-400 ring-1 ring-blue-300' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{t.subject}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.user_name} · {t.user_phone}</p>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                  </div>
                  <span className={TICKET_BADGE[t.status] || 'badge badge-gray'}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
                {t.admin_notes && (
                  <div className="mt-2 pt-2 border-t border-slate-50">
                    <p className="text-xs text-slate-400"><span className="font-semibold">Note:</span> {t.admin_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolve panel */}
      {selected && (
        <div className="w-full lg:w-72 shrink-0 animate-slide-in">
          <div className="card p-5 sticky top-0 space-y-4">
            <div className="flex items-start justify-between">
              <p className="font-bold text-slate-800 text-sm">Update Ticket</p>
              <button onClick={() => setSelected(null)} className="btn-icon"><X size={16} /></button>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">{selected.subject}</p>
              <p className="text-xs text-slate-500 mt-1">{selected.description}</p>
            </div>
            <form onSubmit={saveTicket} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Status</label>
                <select
                  value={resolveForm.status}
                  onChange={(e) => setResolveForm((f) => ({ ...f, status: e.target.value }))}
                  className="select"
                >
                  <option value="open">Open</option>
                  <option value="in_review">In Review</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Admin Notes</label>
                <textarea
                  rows={4}
                  placeholder="Add a note for the user…"
                  value={resolveForm.admin_notes}
                  onChange={(e) => setResolveForm((f) => ({ ...f, admin_notes: e.target.value }))}
                  className="input resize-none"
                />
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full justify-center disabled:opacity-60">
                {saving ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                ) : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
