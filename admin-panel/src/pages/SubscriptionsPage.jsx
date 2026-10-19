import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import SearchField from '../components/SearchField';
import LiveIndicator from '../components/LiveIndicator';
import { useLiveRefresh } from '../hooks/useLiveRefresh';
import { matchesSearch } from '../utils/search';
import {
  Repeat, Pause, Play, XCircle, Milk, Info, CalendarClock, Droplets, IndianRupee,
} from 'lucide-react';

const MILK_LABELS = { cow: 'Cow', buffalo: 'Buffalo', toned: 'Child Pack' };
const SLOT_LABELS = { morning: 'Morning', evening: 'Evening', both: 'Morning + Evening' };

const STATUS_META = {
  active:    { label: 'Active',    badge: 'badge-green',  icon: Play },
  paused:    { label: 'Paused',    badge: 'badge-yellow', icon: Pause },
  cancelled: { label: 'Cancelled', badge: 'badge-gray',   icon: XCircle },
};

const FILTERS = [
  { key: '',          label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'paused',    label: 'Paused' },
  { key: 'cancelled', label: 'Cancelled' },
];

/**
 * Firestore timestamps arrive as { seconds, _seconds } or an ISO string
 * depending on how the document was serialized, so normalize before formatting.
 */
function formatTimestamp(value) {
  if (!value) return null;
  const seconds = value.seconds ?? value._seconds;
  const date = seconds ? new Date(seconds * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const res = await api.get('/subscriptions/admin/list', {
          params: { status: status || undefined, limit: 200 },
        });
        setSubscriptions(res.data.data.subscriptions || []);
        setSummary(res.data.data.summary || null);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load subscriptions');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [status],
  );

  useEffect(() => { load(); }, [load]);

  const { lastUpdated } = useLiveRefresh(() => load({ silent: true }), { intervalMs: 30_000 });

  const filtered = subscriptions.filter((sub) => matchesSearch(search, [
    sub.user?.name,
    sub.user?.phone,
    sub.user?.address,
    sub.milk_type,
    MILK_LABELS[sub.milk_type],
    sub.status,
  ]));

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Subscriptions</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Recurring milk deliveries in your area, with their lifecycle state
          </p>
        </div>
        <LiveIndicator lastUpdated={lastUpdated} />
      </div>

      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        <Info size={15} className="shrink-0 mt-0.5" />
        <span>
          Customers manage their own subscriptions from the app. A pause, resume or cancellation
          applies from the <strong>effective date</strong> shown below — once an area&apos;s cutoff has
          passed, tomorrow&apos;s manifest is already committed, so the change starts the day after.
        </span>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatTile icon={Play}      label="Active"       value={summary.active}    tone="text-emerald-600" />
          <StatTile icon={Pause}     label="Paused"       value={summary.paused}    tone="text-amber-600" />
          <StatTile icon={XCircle}   label="Cancelled"    value={summary.cancelled} tone="text-slate-500" />
          <StatTile icon={Droplets}  label="Daily litres" value={summary.daily_litres} tone="text-blue-600" />
          <StatTile icon={IndianRupee} label="Daily value" value={`Rs.${summary.daily_value}`} tone="text-violet-600" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.key || 'all'}
            type="button"
            onClick={() => setStatus(filter.key)}
            className={`btn ${status === filter.key ? 'btn-primary' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {!loading && subscriptions.length > 0 && (
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search by customer, phone, address or milk type..."
          className="max-w-lg"
        />
      )}

      {error && (
        <div className="card p-4 text-sm text-red-600 border-red-100 bg-red-50">{error}</div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Repeat size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">
            {subscriptions.length === 0
              ? 'No subscriptions in this area yet'
              : 'No subscriptions match your search'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sub) => <SubscriptionRow key={sub.id} sub={sub} />)}
        </div>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-1">
        <Icon size={14} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold ${tone}`}>{value ?? 0}</p>
    </div>
  );
}

function SubscriptionRow({ sub }) {
  const meta = STATUS_META[sub.status] || STATUS_META.cancelled;
  const StatusIcon = meta.icon;

  const pausedOn = formatTimestamp(sub.paused_at);
  const cancelledOn = formatTimestamp(sub.cancelled_at);
  const resumedOn = formatTimestamp(sub.resumed_at);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm">
            {sub.user?.name || (
              <span className="text-slate-400 italic font-normal text-xs">
                {sub.user_id ? `${sub.user_id.slice(0, 10)}...` : 'Unknown customer'}
              </span>
            )}
          </p>
          {sub.user?.phone && <p className="text-xs text-slate-500">{sub.user.phone}</p>}
          {sub.user?.address && (
            <p className="text-xs text-slate-400 truncate max-w-md">{sub.user.address}</p>
          )}
        </div>

        <span className={`badge ${meta.badge}`}>
          <StatusIcon size={11} />
          {meta.label}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100">
        <Field icon={Milk} label="Milk">
          {sub.quantity_litres}L {MILK_LABELS[sub.milk_type] || sub.milk_type}
        </Field>
        <Field icon={IndianRupee} label="Daily value">
          Rs.{sub.daily_value} <span className="text-slate-400">@ Rs.{sub.price_per_litre}/L</span>
        </Field>
        <Field icon={CalendarClock} label="Slot">
          {SLOT_LABELS[sub.delivery_slot] || sub.delivery_slot}
        </Field>
        <Field icon={CalendarClock} label="Effective from">
          {formatDate(sub.effective_from)}
        </Field>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
        <span>Started {formatDate(sub.start_date)}</span>
        {sub.status === 'paused' && pausedOn && <span>Paused on {pausedOn}</span>}
        {sub.status === 'active' && resumedOn && <span>Resumed on {resumedOn}</span>}
        {sub.status === 'cancelled' && cancelledOn && <span>Cancelled on {cancelledOn}</span>}
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-slate-400 mb-0.5">
        <Icon size={12} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-sm text-slate-700 font-medium">{children}</p>
    </div>
  );
}
