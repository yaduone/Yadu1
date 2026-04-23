import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Download, RefreshCw, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function ManifestsPage() {
  const [nextDay, setNextDay]       = useState(null);   // { delivery_date, is_ready, cron_time, manifest }
  const [manifests, setManifests]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState('');

  // Regenerate-past state
  const [regenDate, setRegenDate]       = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [regenMsg, setRegenMsg]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextDayRes, listRes] = await Promise.all([
        api.get('/manifests/next-day'),
        api.get('/manifests'),
      ]);
      setNextDay(nextDayRes.data.data);
      // Filter out tomorrow from the historical list to avoid duplication
      const tomorrow = nextDayRes.data.data.delivery_date;
      setManifests((listRes.data.data.manifests || []).filter((m) => m.date !== tomorrow));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s to catch the cron running
  useEffect(() => {
    const interval = setInterval(() => {
      if (nextDay && !nextDay.is_ready) load();
    }, 60_000);
    return () => clearInterval(interval);
  }, [nextDay, load]);

  async function handleDownload(id, date) {
    try {
      const res = await api.get(`/manifests/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `manifest_${date}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err.response?.data?.error || 'Download failed';
      alert(msg);
    }
  }

  async function handleTrigger() {
    setTriggering(true);
    setTriggerError('');
    try {
      await api.post('/manifests/trigger');
      await load();
    } catch (err) {
      setTriggerError(err.response?.data?.error || 'Trigger failed');
    } finally {
      setTriggering(false);
    }
  }

  async function handleRegenerate() {
    if (!regenDate) return;
    setRegenerating(true);
    setRegenMsg('');
    try {
      await api.post('/manifests/regenerate', { date: regenDate });
      setRegenMsg(`Manifest for ${regenDate} regenerated.`);
      setRegenDate('');
      await load();
    } catch (err) {
      setRegenMsg(err.response?.data?.error || 'Regeneration failed');
    } finally {
      setRegenerating(false);
    }
  }

  // Max selectable date for regenerate = today (not tomorrow or future)
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Delivery Manifests</h2>

      {/* ── Next-Day Manifest Card ─────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse h-32" />
      ) : nextDay && (
        <div className={`rounded-xl border-2 p-6 ${
          nextDay.is_ready && nextDay.manifest
            ? 'bg-green-50 border-green-300'
            : nextDay.is_ready && !nextDay.manifest
            ? 'bg-orange-50 border-orange-300'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {nextDay.is_ready && nextDay.manifest ? (
                <CheckCircle className="mt-0.5 text-green-600 shrink-0" size={22} />
              ) : nextDay.is_ready && !nextDay.manifest ? (
                <AlertCircle className="mt-0.5 text-orange-500 shrink-0" size={22} />
              ) : (
                <Clock className="mt-0.5 text-gray-400 shrink-0" size={22} />
              )}

              <div>
                <p className="font-bold text-gray-800 text-base">
                  Next Day Manifest — {nextDay.delivery_date}
                </p>

                {nextDay.is_ready && nextDay.manifest ? (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-sm text-green-700 font-medium">Ready for download</p>
                    <p className="text-xs text-gray-500">
                      Generated at {nextDay.manifest.generated_at
                        ? new Date(nextDay.manifest.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                      {' · '}{nextDay.manifest.total_users} customers
                      {' · '}{nextDay.manifest.total_milk_litres}L milk
                      {' · '}₹{nextDay.manifest.total_amount?.toFixed(2)}
                    </p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-md">
                        ☀ Morning: {nextDay.manifest.morning_users ?? '—'} customers · {nextDay.manifest.morning_milk_litres ?? '—'}L
                      </span>
                      <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
                        🌙 Evening: {nextDay.manifest.evening_users ?? '—'} customers · {nextDay.manifest.evening_milk_litres ?? '—'}L
                      </span>
                    </div>
                  </div>
                ) : nextDay.is_ready && !nextDay.manifest ? (
                  <div className="mt-1">
                    <p className="text-sm text-orange-700">
                      It's past {nextDay.cron_time} but no manifest was found.
                      The nightly job may have encountered an error.
                    </p>
                    {triggerError && <p className="text-xs text-red-600 mt-1">{triggerError}</p>}
                  </div>
                ) : (
                  <div className="mt-1">
                    <p className="text-sm text-gray-500">
                      Manifest will be automatically generated at{' '}
                      <span className="font-semibold text-gray-700">{nextDay.cron_time}</span> tonight.
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Customer modifications are locked after {nextDay.cron_time.replace('23', '21')}.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action button */}
            <div className="shrink-0">
              {nextDay.is_ready && nextDay.manifest ? (
                <button
                  onClick={() => handleDownload(nextDay.manifest.id, nextDay.delivery_date)}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={15} />
                  Download PDF
                </button>
              ) : nextDay.is_ready && !nextDay.manifest ? (
                <button
                  onClick={handleTrigger}
                  disabled={triggering}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                >
                  <RefreshCw size={15} className={triggering ? 'animate-spin' : ''} />
                  {triggering ? 'Generating…' : 'Generate Now'}
                </button>
              ) : (
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
                  Pending
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Regenerate Past Manifest ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Regenerate a past manifest</p>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={regenDate}
            max={todayStr}
            onChange={(e) => { setRegenDate(e.target.value); setRegenMsg(''); }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleRegenerate}
            disabled={!regenDate || regenerating}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
          {regenMsg && (
            <span className={`text-xs ${regenMsg.includes('failed') || regenMsg.includes('Cannot') ? 'text-red-600' : 'text-green-600'}`}>
              {regenMsg}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">Only today and past dates can be regenerated.</p>
      </div>

      {/* ── Historical Manifests Table ────────────────────────────────────── */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Past Manifests</p>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : manifests.length === 0 ? (
          <p className="text-gray-400 text-sm">No past manifests found.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Customers</th>
                  <th className="text-left px-4 py-3 font-medium text-yellow-700">☀ Morning</th>
                  <th className="text-left px-4 py-3 font-medium text-indigo-700">🌙 Evening</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Total Milk (L)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Extras</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Generated</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">By</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {manifests.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{m.date}</td>
                    <td className="px-4 py-3 text-gray-600">{m.total_users}</td>
                    <td className="px-4 py-3 text-yellow-700 text-xs">
                      {m.morning_users ?? '—'} cust · {m.morning_milk_litres ?? '—'}L
                    </td>
                    <td className="px-4 py-3 text-indigo-700 text-xs">
                      {m.evening_users ?? '—'} cust · {m.evening_milk_litres ?? '—'}L
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.total_milk_litres}</td>
                    <td className="px-4 py-3 text-gray-600">{m.total_extra_items}</td>
                    <td className="px-4 py-3 font-medium">₹{m.total_amount?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {m.generated_at
                        ? new Date(m.generated_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {m.generated_by === 'system' ? 'Auto' : 'Manual'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDownload(m.id, m.date)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Download PDF"
                      >
                        <Download size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
