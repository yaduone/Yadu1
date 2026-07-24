import { useEffect, useState } from 'react';
import { Mail, Save, RefreshCw, Plus, Trash2 } from 'lucide-react';
import api from '../services/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let rowSeq = 0;
const rowKey = () => `row_${Date.now()}_${rowSeq++}`;

function withKeys(list) {
  return (list || []).map((email) => ({ email, _k: rowKey() }));
}

export default function EmailAlertsPage() {
  const [config, setConfig] = useState({
    enabled: false,
    instant_order_created: true,
    recipients: [],
  });
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  function snapshot(cfg, rows) {
    return JSON.stringify({
      enabled: cfg.enabled,
      instant_order_created: cfg.instant_order_created,
      recipients: rows.map((r) => r.email.trim().toLowerCase()).filter(Boolean),
    });
  }

  async function load() {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.get('/settings/email-notifications');
      const c = res.data.data.config || {};
      const rows = withKeys(c.recipients);
      const next = {
        enabled: !!c.enabled,
        instant_order_created: c.instant_order_created !== false,
        recipients: rows,
      };
      setConfig(next);
      setSaved(snapshot(next, rows));
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const isChanged = snapshot(config, config.recipients) !== saved;

  function setField(field, value) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  function updateRow(key, value) {
    setConfig((prev) => ({
      ...prev,
      recipients: prev.recipients.map((r) => (r._k === key ? { ...r, email: value } : r)),
    }));
  }

  function addRow() {
    setConfig((prev) => ({ ...prev, recipients: [...prev.recipients, { email: '', _k: rowKey() }] }));
  }

  function removeRow(key) {
    setConfig((prev) => ({ ...prev, recipients: prev.recipients.filter((r) => r._k !== key) }));
  }

  async function save() {
    const emails = config.recipients.map((r) => r.email.trim().toLowerCase()).filter(Boolean);
    const invalid = emails.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length) {
      setMessage({ type: 'error', text: `Invalid email: ${invalid[0]}` });
      return;
    }
    if (config.enabled && !emails.length) {
      setMessage({ type: 'error', text: 'Add at least one recipient before enabling alerts.' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.put('/settings/email-notifications', {
        enabled: config.enabled,
        instant_order_created: config.instant_order_created,
        recipients: emails,
      });
      const c = res.data.data.config || {};
      const rows = withKeys(c.recipients);
      const next = {
        enabled: !!c.enabled,
        instant_order_created: c.instant_order_created !== false,
        recipients: rows,
      };
      setConfig(next);
      setSaved(snapshot(next, rows));
      setMessage({ type: 'success', text: 'Email alert settings saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Email Alerts</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Send a Gmail alert to your team whenever a customer places an instant order.
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
        <div className="card h-64 animate-pulse bg-slate-50" />
      ) : (
        <div className="card p-5 max-w-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-rose-600 bg-rose-50">
              <Mail size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Instant Order Emails</p>
              <p className="text-xs text-slate-400 mt-0.5">Delivered via Gmail to the recipients below.</p>
            </div>
          </div>

          {/* Master switch */}
          <label className="flex items-center justify-between py-2 cursor-pointer">
            <span className="text-sm font-medium text-slate-700">Enable email alerts</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setField('enabled', e.target.checked)}
              className="h-4 w-4"
            />
          </label>

          <label className="flex items-center justify-between py-2 cursor-pointer border-t border-slate-100">
            <span className="text-sm text-slate-700">
              Email on new instant order
              <span className="block text-xs text-slate-400">Sent the moment an order is placed.</span>
            </span>
            <input
              type="checkbox"
              checked={config.instant_order_created}
              onChange={(e) => setField('instant_order_created', e.target.checked)}
              disabled={!config.enabled}
              className="h-4 w-4"
            />
          </label>

          {/* Recipients */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recipients</p>
            <div className="space-y-2">
              {config.recipients.length === 0 && (
                <p className="text-xs text-slate-400 py-2 text-center">No recipients yet. Add one below.</p>
              )}
              {config.recipients.map((r) => (
                <div key={r._k} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={r.email}
                    placeholder="name@example.com"
                    onChange={(e) => updateRow(r._k, e.target.value)}
                    className="input flex-1"
                  />
                  <button
                    onClick={() => removeRow(r._k)}
                    className="btn-ghost btn-sm shrink-0 text-red-500"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addRow} className="btn-ghost btn-sm mt-3">
              <Plus size={14} />
              Add Recipient
            </button>
          </div>

          <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100">
            <button onClick={save} disabled={saving || !isChanged} className="btn-primary disabled:opacity-50">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save'}
            </button>
            {isChanged && <span className="text-xs text-amber-600">Unsaved changes</span>}
          </div>
        </div>
      )}
    </div>
  );
}
