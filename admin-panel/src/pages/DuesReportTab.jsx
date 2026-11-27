import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import SearchField from '../components/SearchField';
import { matchesSearch } from '../utils/search';
import { FileText, FileSpreadsheet, FileDown, X, CalendarRange, User, RefreshCw } from 'lucide-react';

// Account statement for one customer over a date range: preview here, then
// download it as PDF, Excel or CSV. All numbers come from the backend
// (GET /dues/admin/user/:id/report) so the preview and the files agree.

const KIND_LABELS = {
  opening: 'Opening',
  charge: 'Delivery',
  payment: 'Payment',
  adjustment_charge: 'Due added',
  adjustment_credit: 'Due reduced',
  reversal: 'Reversal',
};

const ORDER_BADGE = {
  delivered: 'badge badge-green',
  pending: 'badge badge-yellow',
  not_delivered: 'badge badge-gray',
  cancelled: 'badge badge-red',
  skipped: 'badge badge-gray',
};

const INSTANT_BADGE = {
  delivered: 'badge badge-green',
  pending: 'badge badge-yellow',
  acknowledged: 'badge badge-blue',
  cancelled: 'badge badge-red',
  rejected: 'badge badge-red',
};

const FORMATS = [
  { key: 'pdf', label: 'PDF', icon: FileText },
  { key: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { key: 'csv', label: 'CSV', icon: FileDown },
];

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs = (n) => `${n < 0 ? '-' : ''}₹${inr.format(Math.abs(Number(n) || 0))}`;

function balanceText(n) {
  if (n > 0) return `${rs(n)} due`;
  if (n < 0) return `${rs(-n)} advance`;
  return rs(0);
}

function balanceColor(n) {
  if (n > 0) return 'text-red-600';
  if (n < 0) return 'text-emerald-600';
  return 'text-slate-600';
}

function iso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shortDate(value) {
  if (!value) return '';
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function presets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = iso(now);
  // Indian financial year starts on 1 April.
  const fyStart = m >= 3 ? y : y - 1;
  return [
    { label: 'This month', from: iso(new Date(y, m, 1)), to: today },
    { label: 'Last month', from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    { label: 'Last 3 months', from: iso(new Date(y, m - 2, 1)), to: today },
    { label: 'This financial year', from: `${fyStart}-04-01`, to: today },
    { label: 'Last 12 months', from: iso(new Date(y - 1, m, now.getDate() + 1)), to: today },
  ];
}

function formatAddress(address) {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [address.line1, address.line2, address.landmark, address.pincode].filter(Boolean).join(', ');
}

// A blob error response still carries the backend's JSON message.
async function errorMessage(err, fallback) {
  const data = err.response?.data;
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text()).error || fallback; } catch { return fallback; }
  }
  return data?.error || err.message || fallback;
}

export default function DuesReportTab({ initialUserId = null }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userId, setUserId] = useState(initialUserId);
  const [search, setSearch] = useState('');
  const defaultRange = presets()[0];
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);

  const [report, setReport] = useState(null);
  const [reportKey, setReportKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/users/admin/list')
      .then((res) => { if (!cancelled) setUsers(res.data.data.users || []); })
      .catch((e) => console.error(e))
      .finally(() => { if (!cancelled) setLoadingUsers(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (initialUserId) setUserId(initialUserId); }, [initialUserId]);

  const selectedUser = users.find((u) => u.id === userId) || null;
  const filteredUsers = useMemo(() => users
    .filter((u) => matchesSearch(search, [u.name, u.phone, formatAddress(u.address)]))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '')), [users, search]);

  const rangeError = !from || !to ? 'Choose both dates' : from > to ? '"From" must be on or before "To"' : '';
  const currentKey = `${userId}|${from}|${to}`;
  const stale = report && reportKey !== currentKey;

  async function generate() {
    if (!userId || rangeError) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/dues/admin/user/${userId}/report`, { params: { from, to } });
      setReport(res.data.data.report);
      setReportKey(currentKey);
    } catch (e) {
      setError(await errorMessage(e, 'Failed to generate report'));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  async function download(format) {
    if (!userId || rangeError) return;
    setDownloading(format);
    setError('');
    try {
      const res = await api.get(`/dues/admin/user/${userId}/report`, {
        params: { from, to, format },
        responseType: 'blob',
      });
      const who = (selectedUser?.name || selectedUser?.phone || 'customer')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'customer';
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement_${who}_${from}_to_${to}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(await errorMessage(e, 'Download failed'));
    } finally {
      setDownloading('');
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* Left: builder */}
      <div className="w-full lg:w-80 shrink-0 space-y-4">
        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <User size={13} /> Customer
          </p>
          {selectedUser ? (
            <div className="flex items-start justify-between gap-2 rounded-xl bg-blue-50/70 p-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{selectedUser.name || 'Unnamed customer'}</p>
                <p className="text-xs text-slate-500">{selectedUser.phone}</p>
                {formatAddress(selectedUser.address) && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{formatAddress(selectedUser.address)}</p>
                )}
              </div>
              <button type="button" className="btn-icon p-1" onClick={() => setUserId(null)} aria-label="Change customer">
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <SearchField value={search} onChange={setSearch} placeholder="Search name, phone or address..." />
              <div className="max-h-64 overflow-y-auto -mx-1 px-1 space-y-1">
                {loadingUsers ? (
                  [...Array(4)].map((_, i) => <div key={i} className="h-11 rounded-lg animate-pulse bg-slate-50" />)
                ) : filteredUsers.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No customers found</p>
                ) : (
                  filteredUsers.slice(0, 100).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setUserId(u.id); setSearch(''); }}
                      className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-slate-50 flex items-center gap-2.5"
                    >
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                        {u.name ? u.name[0].toUpperCase() : '?'}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-800 truncate">{u.name || 'Unnamed customer'}</span>
                        <span className="block text-xs text-slate-400">{u.phone || u.id.slice(0, 10)}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              {filteredUsers.length > 100 && (
                <p className="text-[11px] text-slate-400">Showing 100 of {filteredUsers.length} — refine your search.</p>
              )}
            </>
          )}
        </div>

        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <CalendarRange size={13} /> Period
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500 space-y-1">
              <span>From</span>
              <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-xs text-slate-500 space-y-1">
              <span>To</span>
              <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets().map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => { setFrom(p.from); setTo(p.to); }}
                className={`btn btn-sm ${from === p.from && to === p.to ? 'btn-primary' : 'btn-secondary'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {rangeError && <p className="text-xs text-red-600">{rangeError}</p>}
          <button
            type="button"
            onClick={generate}
            disabled={!userId || !!rangeError || loading}
            className="btn-primary w-full justify-center disabled:opacity-60"
          >
            {loading ? (
              <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
            ) : report && !stale ? <><RefreshCw size={14} /> Refresh report</> : 'Generate report'}
          </button>
          {!userId && <p className="text-xs text-slate-400">Pick a customer to start.</p>}
        </div>

        <div className="card p-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Download</p>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => download(key)}
                disabled={!userId || !!rangeError || !!downloading}
                className="btn btn-secondary btn-sm justify-center disabled:opacity-50"
              >
                {downloading === key
                  ? <span className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  : <Icon size={13} />}
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            Includes opening balance, every order, charges, payments, manual adjustments and instant (COD) orders.
          </p>
        </div>

        {error && <div className="card p-3 text-sm text-red-600 bg-red-50 border-red-100">{error}</div>}
      </div>

      {/* Right: preview */}
      <div className="flex-1 min-w-0">
        {loading && !report ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-slate-50" />)}
            </div>
            <div className="card h-72 animate-pulse bg-slate-50" />
          </div>
        ) : report ? (
          <ReportPreview report={report} stale={stale} />
        ) : (
          <div className="card p-12 text-center text-slate-400">
            <FileText size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="font-medium text-slate-500">Customer statement</p>
            <p className="text-sm mt-1">Choose a customer and a period, then generate a preview or download it directly.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportPreview({ report, stale }) {
  const s = report.summary;
  const c = report.customer;
  const tiles = [
    { label: 'Opening balance', value: balanceText(s.opening_balance), color: balanceColor(s.opening_balance), bg: 'bg-slate-50' },
    {
      label: 'Charges',
      value: rs(s.total_charges),
      sub: `${s.orders_delivered} deliveries${s.adjustment_charges ? ` + ${rs(s.adjustment_charges)} added` : ''}`,
      color: 'text-slate-800',
      bg: 'bg-slate-50',
    },
    {
      label: s.adjustment_credits ? 'Payments & credits' : 'Payments',
      value: rs(s.total_credits),
      sub: `${s.payments_count} payments${s.adjustment_credits ? ` + ${rs(s.adjustment_credits)} reduced` : ''}`,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Closing balance',
      value: balanceText(s.closing_balance),
      color: balanceColor(s.closing_balance),
      bg: s.closing_balance > 0 ? 'bg-red-50' : s.closing_balance < 0 ? 'bg-emerald-50' : 'bg-slate-50',
    },
  ];

  return (
    <div className={`space-y-4 ${stale ? 'opacity-60' : ''}`}>
      {stale && (
        <div className="card p-3 text-xs text-amber-700 bg-amber-50 border-amber-100">
          Customer or dates changed — generate again to update the preview. Downloads always use the current selection.
        </div>
      )}

      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <p className="font-bold text-slate-800">{c.name || 'Customer'} <span className="font-normal text-slate-400 text-sm">· {c.phone}</span></p>
          <p className="text-xs text-slate-500">{c.address || 'No address'}{c.area_name ? ` · ${c.area_name}` : ''}</p>
        </div>
        <p className="text-sm text-slate-600 font-medium">
          {shortDate(report.period.from)} – {shortDate(report.period.to)}
          <span className="text-slate-400 font-normal"> · {report.period.days} days</span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={`${t.bg} rounded-2xl p-4`}>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">{t.label}</p>
            <p className={`text-lg font-bold mt-1 ${t.color}`}>{t.value}</p>
            {t.sub && <p className="text-[11px] text-slate-500 mt-0.5">{t.sub}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="badge badge-gray">{s.orders_total} orders</span>
        <span className="badge badge-green">{s.orders_delivered} delivered</span>
        {s.orders_not_delivered > 0 && <span className="badge badge-gray">{s.orders_not_delivered} not delivered</span>}
        {s.orders_pending > 0 && <span className="badge badge-yellow">{s.orders_pending} pending</span>}
        <span className="badge badge-blue">Milk {s.milk_litres_delivered} L · {rs(s.milk_amount)}</span>
        <span className="badge badge-blue">Extras {rs(s.extras_amount)}</span>
        {s.instant_orders_total > 0 && <span className="badge badge-purple">{s.instant_orders_total} instant · {rs(s.instant_cod_amount)} COD</span>}
      </div>

      {s.unreconciled_adjustment !== 0 && (
        <div className="card p-3 text-xs text-amber-800 bg-amber-50 border-amber-100">
          The balance on the account today ({balanceText(s.account_balance_today)}) differs from the balance rebuilt from
          orders, payments and adjustments by {rs(s.unreconciled_adjustment)}. Something changed it without leaving a record.
        </div>
      )}

      <Section title="Ledger" count={report.ledger.length - 1}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Particulars</th>
              <th className="text-right">Charges</th>
              <th className="text-right">Paid / credit</th>
              <th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {report.ledger.map((e, i) => (
              <tr key={`${e.kind}-${e.ref || 'open'}-${i}`}>
                <td className="whitespace-nowrap text-slate-500">{shortDate(e.date)}</td>
                <td>
                  <span className={e.kind === 'opening' ? 'font-semibold' : e.kind === 'reversal' ? 'text-slate-500' : ''}>{e.description}</span>
                  {e.kind !== 'opening' && e.kind !== 'charge' && e.kind !== 'payment' && (
                    <span className="badge badge-yellow ml-2">{KIND_LABELS[e.kind]}</span>
                  )}
                </td>
                <td className="text-right whitespace-nowrap">{e.debit ? rs(e.debit) : ''}</td>
                <td className="text-right whitespace-nowrap text-emerald-600">{e.credit ? rs(e.credit) : ''}</td>
                <td className={`text-right whitespace-nowrap font-semibold ${balanceColor(e.balance)}`}>{balanceText(e.balance)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td />
              <td>Closing balance</td>
              <td className="text-right whitespace-nowrap">{rs(s.total_charges)}</td>
              <td className="text-right whitespace-nowrap text-emerald-600">{rs(s.total_credits)}</td>
              <td className={`text-right whitespace-nowrap ${balanceColor(s.closing_balance)}`}>{balanceText(s.closing_balance)}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Orders" count={report.orders.length} defaultOpen={false}>
        {report.orders.length === 0 ? <Empty text="No scheduled orders in this period." /> : (
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Slot</th><th>Items</th><th>Status</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody>
              {report.orders.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap text-slate-500">{shortDate(o.date)}</td>
                  <td className="whitespace-nowrap text-slate-500">{o.slot_label}</td>
                  <td>
                    {o.description}
                    {o.reason_label && o.status !== 'delivered' && <p className="text-xs text-slate-400">{o.reason_label}</p>}
                  </td>
                  <td><span className={ORDER_BADGE[o.status] || 'badge badge-gray'}>{o.status_label}</span></td>
                  <td className={`text-right whitespace-nowrap ${o.status === 'delivered' ? 'font-semibold' : 'text-slate-400'}`}>
                    {o.status === 'delivered' ? rs(o.total_amount) : o.total_amount ? `${rs(o.total_amount)} (not billed)` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Payments" count={report.payments.length} defaultOpen={false}>
        {report.payments.length === 0 ? <Empty text="No payments recorded in this period." /> : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Method</th><th>Notes</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {report.payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap text-slate-500">{shortDate(p.date)}</td>
                  <td><span className="badge badge-green">{p.method_label}</span></td>
                  <td className="text-slate-500">{p.notes || '—'}</td>
                  <td className="text-right font-semibold text-emerald-600 whitespace-nowrap">{rs(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {report.adjustments.length > 0 && (
        <Section title="Manual adjustments" count={report.adjustments.length} defaultOpen={false}>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Reason</th><th>By</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {report.adjustments.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-slate-500">{shortDate(a.date)}</td>
                  <td><span className={a.type === 'charge' ? 'badge badge-yellow' : 'badge badge-green'}>{a.type_label}</span></td>
                  <td>
                    {a.category_label}{a.note ? `: ${a.note}` : ''}
                    {a.voided && (
                      <p className="text-xs text-slate-400">
                        Reversed on {shortDate(a.voided_on)}{a.void_reason ? ` — ${a.void_reason}` : ''}
                      </p>
                    )}
                  </td>
                  <td className="text-slate-500">{a.created_by || '—'}</td>
                  <td className={`text-right whitespace-nowrap font-semibold ${a.voided ? 'text-slate-400 line-through' : ''}`}>
                    {a.type === 'credit' ? '-' : '+'}{rs(a.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {report.instant_orders.length > 0 && (
        <Section title="Instant orders (cash on delivery)" count={report.instant_orders.length} defaultOpen={false}>
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Items</th><th className="text-right">Delivery</th><th className="text-right">Other</th><th>Status</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody>
              {report.instant_orders.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap text-slate-500">{shortDate(o.date)}</td>
                  <td>
                    {o.description}
                    {o.added_to_due && <p className="text-xs text-amber-600">Added to due</p>}
                  </td>
                  <td className="text-right whitespace-nowrap text-slate-500">{rs(o.delivery_charge)}</td>
                  <td className="text-right whitespace-nowrap text-slate-500">{rs(o.extra_charges_total)}</td>
                  <td><span className={INSTANT_BADGE[o.status] || 'badge badge-gray'}>{o.status_label}</span></td>
                  <td className="text-right whitespace-nowrap font-semibold">{rs(o.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400 px-4 py-2">Paid at the door; not part of the balance unless added to the due.</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="text-sm font-bold text-slate-700">{title} <span className="text-slate-400 font-normal">({count})</span></span>
        <span className="text-xs text-blue-600 font-semibold">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div className="overflow-x-auto border-t border-slate-100">{children}</div>}
    </div>
  );
}

function Empty({ text }) {
  return <p className="text-sm text-slate-400 px-4 py-6 text-center">{text}</p>;
}
