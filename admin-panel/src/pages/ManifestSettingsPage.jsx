import { useEffect, useState } from 'react';
import { Clock, Save, RefreshCw } from 'lucide-react';
import api from '../services/api';

export default function ManifestSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [cutoffTime, setCutoffTime] = useState('');
  const [generationTime, setGenerationTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.get('/settings/manifest');
      const next = res.data.data.settings;
      setSettings(next);
      setCutoffTime(next.cutoff_time);
      setGenerationTime(next.generation_time);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const res = await api.put('/settings/manifest', {
        cutoff_time: cutoffTime,
        generation_time: generationTime,
      });
      const next = res.data.data.settings;
      setSettings(next);
      setCutoffTime(next.cutoff_time);
      setGenerationTime(next.generation_time);
      setMessage('Manifest schedule updated.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to update schedule');
    } finally {
      setSaving(false);
    }
  }

  const changed = settings
    ? cutoffTime !== settings.cutoff_time || generationTime !== settings.generation_time
    : false;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Manifest Schedule</h2>
          <p className="text-xs text-slate-400 mt-0.5">Cutoff and generation time for your delivery area</p>
        </div>
        <button onClick={load} disabled={loading || saving} className="btn-ghost btn-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="card h-44 animate-pulse bg-slate-50" />
      ) : (
        <div className="card p-5 max-w-xl">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Daily cutoff</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Timezone: {settings?.timezone || 'Asia/Kolkata'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Cutoff Time
              </span>
              <input
                type="time"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                className="input mt-1.5"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Manifest Generation
              </span>
              <input
                type="time"
                value={generationTime}
                onChange={(e) => setGenerationTime(e.target.value)}
                className="input mt-1.5"
              />
            </label>
          </div>

          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <button
              onClick={save}
              disabled={saving || !changed}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
            {message && (
              <span className={`text-xs font-medium ${
                message.includes('Failed') || message.includes('must') ? 'text-red-600' : 'text-emerald-600'
              }`}>
                {message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
