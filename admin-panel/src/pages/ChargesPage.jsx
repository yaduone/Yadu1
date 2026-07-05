import { useEffect, useState } from 'react';
import { Receipt, Save, RefreshCw, Plus, Trash2, Zap, CalendarClock } from 'lucide-react';
import api from '../services/api';

// Configurable cart-confirmation charges (platform fee, delivery charge, QA fees…).
// Scheduled and instant deliveries keep independent lists.
const TYPES = [
  { key: 'scheduled', label: 'Scheduled Deliveries', icon: CalendarClock, accent: 'text-blue-600 bg-blue-50' },
  { key: 'instant', label: 'Instant Deliveries', icon: Zap, accent: 'text-amber-600 bg-amber-50' },
];

let rowSeq = 0;
const rowKey = () => `row_${Date.now()}_${rowSeq++}`;

function withKeys(list) {
  return (list || []).map((c) => ({ ...c, _k: rowKey() }));
}

export default function ChargesPage() {
  const [lists, setLists] = useState({ scheduled: [], instant: [] });
  const [saved, setSaved] = useState({ scheduled: [], instant: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  async function load() {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.get('/settings/charges');
      const charges = res.data.data.charges || { scheduled: [], instant: [] };
      const next = { scheduled: withKeys(charges.scheduled), instant: withKeys(charges.instant) };
      setLists(next);
      setSaved({
        scheduled: JSON.stringify(charges.scheduled || []),
        instant: JSON.stringify(charges.instant || []),
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load charges' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function stripKeys(list) {
    return list.map(({ _k, ...c }) => ({ ...c, name: (c.name || '').trim(), amount: Number(c.amount) || 0 }));
  }

  function isChanged(type) {
    return JSON.stringify(stripKeys(lists[type])) !== saved[type];
  }

  function updateRow(type, key, field, value) {
    setLists((prev) => ({
      ...prev,
      [type]: prev[type].map((c) => (c._k === key ? { ...c, [field]: value } : c)),
    }));
  }

  function addRow(type) {
    setLists((prev) => ({
      ...prev,
      [type]: [...prev[type], { _k: rowKey(), name: '', amount: 0 }],
    }));
  }

  function removeRow(type, key) {
    setLists((prev) => ({ ...prev, [type]: prev[type].filter((c) => c._k !== key) }));
  }

  async function save(type) {
    const cleaned = stripKeys(lists[type]);
    if (cleaned.some((c) => !c.name)) {
      setMessage({ type: 'error', text: 'Every charge needs a name.' });
      return;
    }
    if (cleaned.some((c) => c.amount < 0)) {
      setMessage({ type: 'error', text: 'Amounts cannot be negative.' });
      return;
    }

    setSaving(type);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.put(`/settings/charges/${type}`, { charges: cleaned });
      const returned = res.data.data.charges || [];
      setLists((prev) => ({ ...prev, [type]: withKeys(returned) }));
      setSaved((prev) => ({ ...prev, [type]: JSON.stringify(returned) }));
      setMessage({ type: 'success', text: `${TYPES.find((t) => t.key === type).label} charges saved.` });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save charges' });
    } finally {
      setSaving('');
    }
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Cart Charges</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Extra charges shown at cart confirmation. Amount 0 displays as a green “Free”.
          </p>
        </div>
        <button onClick={load} disabled={loading || saving} className="btn-ghost btn-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {message.text && (
        <div
          className={`text-xs font-medium px-3 py-2 rounded-lg ${
            message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card h-64 animate-pulse bg-slate-50" />
          <div className="card h-64 animate-pulse bg-slate-50" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {TYPES.map(({ key, label, icon: Icon, accent }) => (
            <div key={key} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{lists[key].length} charge(s)</p>
                </div>
              </div>

              <div className="space-y-2">
                {lists[key].length === 0 && (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No charges yet. Add one below.
                  </p>
                )}

                {lists[key].map((c) => {
                  const free = (Number(c.amount) || 0) === 0;
                  return (
                    <div key={c._k} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={c.name}
                        placeholder="Charge name (e.g. Platform fee)"
                        onChange={(e) => updateRow(key, c._k, 'name', e.target.value)}
                        className="input flex-1"
                      />
                      <div className="relative w-28 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={c.amount}
                          onChange={(e) => updateRow(key, c._k, 'amount', e.target.value)}
                          className="input pl-6"
                        />
                      </div>
                      {free && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-1 rounded shrink-0">
                          FREE
                        </span>
                      )}
                      <button
                        onClick={() => removeRow(key, c._k)}
                        className="btn-ghost btn-sm shrink-0 text-red-500"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => addRow(key)} className="btn-ghost btn-sm mt-3">
                <Plus size={14} />
                Add Charge
              </button>

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => save(key)}
                  disabled={saving === key || !isChanged(key)}
                  className="btn-primary disabled:opacity-50"
                >
                  {saving === key ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving === key ? 'Saving...' : 'Save'}
                </button>
                {isChanged(key) && <span className="text-xs text-amber-600">Unsaved changes</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
