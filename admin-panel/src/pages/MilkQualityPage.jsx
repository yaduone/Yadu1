import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlaskConical, RefreshCw, FileDown, Copy, Trash2, Send, Save, EyeOff, ShieldCheck, CalendarDays, Droplets,
} from 'lucide-react';
import api from '../services/api';

// Daily milk quality report. Admins enter the day's lab results per milk
// variety; once published, customers in this area see it on the app home
// screen and can download a branded PDF.

const VARIETY_ACCENTS = {
  cow: 'bg-emerald-500',
  buffalo: 'bg-blue-800',
  toned: 'bg-sky-600',
};

const TEST_OPTIONS = [
  { value: 'negative', label: 'Not detected', active: 'bg-emerald-600 text-white' },
  { value: 'positive', label: 'Detected', active: 'bg-red-600 text-white' },
  { value: 'not_tested', label: 'Not tested', active: 'bg-slate-600 text-white' },
];

const STATUS_DOT = {
  ok: 'bg-emerald-500',
  low: 'bg-amber-500',
  high: 'bg-amber-500',
};

function blankValues(meta) {
  return Object.fromEntries((meta?.parameters || []).map((p) => [p.key, '']));
}

function emptyForm(meta) {
  const varieties = (meta?.milk_types || []).map((m) => m.key);
  return {
    selected: Object.fromEntries(varieties.map((k) => [k, k === 'cow' || k === 'buffalo'])),
    values: Object.fromEntries(varieties.map((k) => [k, blankValues(meta)])),
    tests: Object.fromEntries((meta?.tests || []).map((t) => [t.key, 'not_tested'])),
    grade: '',
    tested_by: '',
    sample_time: '',
    notes: '',
  };
}

function formFromReport(report, meta) {
  const form = emptyForm(meta);
  if (!report) return form;
  Object.keys(form.selected).forEach((k) => { form.selected[k] = false; });
  for (const sample of report.samples || []) {
    form.selected[sample.milk_type] = true;
    form.values[sample.milk_type] = Object.fromEntries(
      Object.entries(sample.values || {}).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)]),
    );
  }
  form.tests = { ...form.tests, ...(report.tests || {}) };
  form.grade = report.grade || '';
  form.tested_by = report.tested_by || '';
  form.sample_time = report.sample_time || '';
  form.notes = report.notes || '';
  return form;
}

function rangeStatus(value, range) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !range) return null;
  if (n < range[0]) return 'low';
  if (n > range[1]) return 'high';
  return 'ok';
}

function formatDay(date, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', opts);
}

export default function MilkQualityPage() {
  const [date, setDate] = useState('');
  const [today, setToday] = useState('');
  const [meta, setMeta] = useState(null);
  const [report, setReport] = useState(null);
  const [recent, setRecent] = useState([]);
  const [form, setForm] = useState(null);
  const [savedForm, setSavedForm] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const load = useCallback(async (targetDate) => {
    setLoading(true);
    try {
      const res = await api.get('/milk-quality/admin', { params: targetDate ? { date: targetDate } : {} });
      const data = res.data.data;
      const next = formFromReport(data.report, data.meta);
      setMeta(data.meta);
      setToday(data.today);
      setDate(data.date);
      setReport(data.report);
      setRecent(data.recent || []);
      setForm(next);
      setSavedForm(JSON.stringify(next));
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load milk quality report' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = form !== null && JSON.stringify(form) !== savedForm;

  function confirmDiscard() {
    return !dirty || window.confirm('You have unsaved changes. Discard them?');
  }

  function switchDate(next) {
    if (!next || next === date || !confirmDiscard()) return;
    setMessage({ type: '', text: '' });
    load(next);
  }

  function update(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function setValue(variety, key, value) {
    setForm((prev) => ({
      ...prev,
      values: { ...prev.values, [variety]: { ...prev.values[variety], [key]: value } },
    }));
  }

  const suggestedGrade = useMemo(() => {
    if (!form || !meta) return null;
    let entered = 0;
    let outOfRange = 0;
    for (const [variety, on] of Object.entries(form.selected)) {
      if (!on) continue;
      for (const p of meta.parameters) {
        const status = rangeStatus(form.values[variety]?.[p.key], meta.reference_ranges[variety]?.[p.key]);
        if (!status) continue;
        entered += 1;
        if (status !== 'ok') outOfRange += 1;
      }
    }
    if (entered === 0) return null;
    const flagged = Object.values(form.tests).includes('positive');
    if (!flagged && outOfRange === 0) return 'excellent';
    if (!flagged && outOfRange <= 2) return 'good';
    return 'satisfactory';
  }, [form, meta]);

  function buildBody(published) {
    const samples = Object.entries(form.selected)
      .filter(([, on]) => on)
      .map(([milkType]) => ({ milk_type: milkType, ...form.values[milkType] }));
    return {
      date,
      published,
      grade: form.grade || null,
      tested_by: form.tested_by,
      sample_time: form.sample_time,
      notes: form.notes,
      samples,
      tests: form.tests,
    };
  }

  async function save(published) {
    setBusy(published ? 'publish' : 'draft');
    setMessage({ type: '', text: '' });
    try {
      const res = await api.put('/milk-quality/admin', buildBody(published));
      await load(date);
      setMessage({
        type: 'success',
        text: published
          ? 'Published. Customers in this area now see this report on the app home screen.'
          : res.data.message || 'Draft saved',
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save report' });
    } finally {
      setBusy('');
    }
  }

  async function copyPrevious() {
    const previous = recent.find((r) => r.exists && r.date < date);
    if (!previous) {
      setMessage({ type: 'error', text: 'No earlier report in the last 14 days to copy from.' });
      return;
    }
    setBusy('copy');
    try {
      const res = await api.get('/milk-quality/admin', { params: { date: previous.date } });
      const copied = formFromReport(res.data.data.report, meta);
      setForm({ ...copied, notes: '' });
      setMessage({
        type: 'info',
        text: `Copied results from ${formatDay(previous.date)}. Update them with today's readings before publishing.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to copy previous report' });
    } finally {
      setBusy('');
    }
  }

  async function previewPdf() {
    // Open the tab synchronously so the popup blocker treats it as user-initiated.
    const win = window.open('', '_blank');
    setBusy('pdf');
    try {
      const res = await api.get('/milk-quality/admin/pdf', { params: { date }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      if (win) win.location.href = url;
      else window.location.assign(url);
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      if (win) win.close();
      let text = 'Failed to generate PDF';
      if (err.response?.data instanceof Blob) {
        try { text = JSON.parse(await err.response.data.text()).error || text; } catch { /* keep default */ }
      }
      setMessage({ type: 'error', text });
    } finally {
      setBusy('');
    }
  }

  async function removeReport() {
    if (!window.confirm(`Delete the milk quality report for ${formatDay(date, { day: 'numeric', month: 'long', year: 'numeric' })}? Customers will no longer see it.`)) return;
    setBusy('delete');
    try {
      await api.delete(`/milk-quality/admin/${date}`);
      await load(date);
      setMessage({ type: 'success', text: 'Report deleted' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete report' });
    } finally {
      setBusy('');
    }
  }

  const status = !report ? 'none' : report.published ? 'published' : 'draft';
  const selectedCount = form ? Object.values(form.selected).filter(Boolean).length : 0;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Milk Quality Report</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Record the day&apos;s lab results. Once published, customers in your area see them on the app home screen
            and can download a branded PDF.
          </p>
        </div>
        <button onClick={() => confirmDiscard() && load(date)} disabled={loading || !!busy} className="btn-ghost btn-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {message.text && (
        <div
          className={`text-xs font-medium px-3 py-2 rounded-lg ${
            message.type === 'error'
              ? 'bg-red-50 text-red-600'
              : message.type === 'info'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading && !form ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card h-96 animate-pulse bg-slate-50 lg:col-span-2" />
          <div className="card h-96 animate-pulse bg-slate-50" />
        </div>
      ) : form && meta ? (
        <>
          {/* ── Date + status bar ─────────────────────────────────────────── */}
          <div className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CalendarDays size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={date}
                    max={today}
                    onChange={(e) => switchDate(e.target.value)}
                    className="input py-1.5 w-40"
                  />
                  {status === 'published' && <span className="badge badge-green">Published</span>}
                  {status === 'draft' && <span className="badge badge-yellow">Draft — not visible to customers</span>}
                  {status === 'none' && <span className="badge badge-gray">Not created</span>}
                  {dirty && <span className="badge badge-blue">Unsaved changes</span>}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {formatDay(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {date === today ? ' · Today' : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={copyPrevious} disabled={!!busy} className="btn-secondary btn-sm">
                <Copy size={14} /> Copy previous
              </button>
              <button
                onClick={previewPdf}
                disabled={!report || !!busy}
                className="btn-secondary btn-sm"
                title={dirty ? 'Shows the last saved version — save to include your changes' : 'Open the PDF customers download'}
              >
                <FileDown size={14} /> {busy === 'pdf' ? 'Generating…' : dirty ? 'Preview saved PDF' : 'Preview PDF'}
              </button>
              {report && (
                <button onClick={removeReport} disabled={!!busy} className="btn-ghost btn-sm text-red-500">
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            <div className="lg:col-span-2 space-y-5">
              {/* ── Test results ────────────────────────────────────────── */}
              <div className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FlaskConical size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Test results</p>
                    <p className="text-xs text-slate-400 mt-0.5">Leave a field blank if it was not tested.</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {meta.milk_types.map((m) => {
                    const on = form.selected[m.key];
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => update({ selected: { ...form.selected, [m.key]: !on } })}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                          on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${VARIETY_ACCENTS[m.key]}`} />
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                {selectedCount === 0 && (
                  <p className="text-xs text-slate-400 py-6 text-center">Select at least one milk variety to enter results.</p>
                )}

                <div className="space-y-4">
                  {meta.milk_types.filter((m) => form.selected[m.key]).map((m) => (
                    <div key={m.key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${VARIETY_ACCENTS[m.key]}`} />
                        {m.label}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {meta.parameters.map((p) => {
                          const range = meta.reference_ranges[m.key]?.[p.key];
                          const value = form.values[m.key]?.[p.key] ?? '';
                          const st = rangeStatus(value, range);
                          return (
                            <label key={p.key} className="block">
                              <span className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
                                {p.label}
                                {st && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[st]}`} />
                                    {st === 'ok' ? 'In range' : st === 'low' ? 'Low' : 'High'}
                                  </span>
                                )}
                              </span>
                              <div className="relative">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  min={p.min}
                                  max={p.max}
                                  value={value}
                                  placeholder="—"
                                  onChange={(e) => setValue(m.key, p.key, e.target.value)}
                                  className={`input ${p.unit ? 'pr-10' : ''}`}
                                />
                                {p.unit && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
                                    {p.unit}
                                  </span>
                                )}
                              </div>
                              {range && (
                                <span className="block text-[11px] text-slate-400 mt-1">
                                  Typical {range[0]} – {range[1]}{p.unit === '%' ? '%' : p.unit ? ` ${p.unit}` : ''}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Adulteration screening ─────────────────────────────── */}
              <div className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Adulteration screening</p>
                    <p className="text-xs text-slate-400 mt-0.5">Only screens marked Not detected or Detected appear on the report.</p>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {meta.tests.map((t) => (
                    <div key={t.key} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm text-slate-700">{t.label}</span>
                      <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                        {TEST_OPTIONS.map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => update({ tests: { ...form.tests, [t.key]: o.value } })}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                              form.tests[t.key] === o.value ? o.active : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {/* ── Details ─────────────────────────────────────────────── */}
              <div className="card p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-800">Report details</p>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Overall grade</span>
                  <select value={form.grade} onChange={(e) => update({ grade: e.target.value })} className="select">
                    <option value="">No grade</option>
                    {Object.entries(meta.grades).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  {suggestedGrade && suggestedGrade !== form.grade && (
                    <button
                      type="button"
                      onClick={() => update({ grade: suggestedGrade })}
                      className="text-[11px] font-semibold text-blue-600 mt-1 hover:underline"
                    >
                      Suggested from results: {meta.grades[suggestedGrade]} — use this
                    </button>
                  )}
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Tested by</span>
                  <input
                    type="text"
                    maxLength={80}
                    value={form.tested_by}
                    placeholder="Name of the person or lab"
                    onChange={(e) => update({ tested_by: e.target.value })}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-600 mb-1">Sample collected at</span>
                  <input
                    type="time"
                    value={form.sample_time}
                    onChange={(e) => update({ sample_time: e.target.value })}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                    Remarks
                    <span className="text-slate-400 font-normal">{form.notes.length}/600</span>
                  </span>
                  <textarea
                    rows={3}
                    maxLength={600}
                    value={form.notes}
                    placeholder="e.g. Morning batch chilled to 4 °C within 30 minutes of milking"
                    onChange={(e) => update({ notes: e.target.value })}
                    className="input resize-y"
                  />
                </label>
              </div>

              {/* ── Publish ─────────────────────────────────────────────── */}
              <div className="card p-5 space-y-3">
                <p className="text-sm font-semibold text-slate-800">Publish</p>
                <p className="text-xs text-slate-500">
                  {status === 'published'
                    ? 'This report is live in the app. Saving again updates it for customers immediately.'
                    : 'Drafts are only visible here. Publish to show the report on the app home screen.'}
                </p>
                <button
                  onClick={() => save(true)}
                  disabled={!!busy || selectedCount === 0}
                  className="btn-primary w-full justify-center"
                >
                  <Send size={15} />
                  {busy === 'publish' ? 'Publishing…' : status === 'published' ? 'Update published report' : 'Publish to app'}
                </button>
                <button
                  onClick={() => save(false)}
                  disabled={!!busy || selectedCount === 0}
                  className="btn-secondary w-full justify-center"
                >
                  {status === 'published' ? <EyeOff size={15} /> : <Save size={15} />}
                  {busy === 'draft' ? 'Saving…' : status === 'published' ? 'Unpublish (keep as draft)' : 'Save draft'}
                </button>
              </div>

              {/* ── Recent ──────────────────────────────────────────────── */}
              <div className="card p-5">
                <p className="text-sm font-semibold text-slate-800 mb-3">Last 14 days</p>
                <div className="space-y-1">
                  {recent.map((r) => (
                    <button
                      key={r.date}
                      type="button"
                      onClick={() => switchDate(r.date)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                        r.date === date ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Droplets size={12} className={r.exists ? 'text-emerald-500' : 'text-slate-300'} />
                        {formatDay(r.date)}{r.date === today ? ' · Today' : ''}
                      </span>
                      {r.published ? (
                        <span className="badge badge-green">{r.grade ? meta.grades[r.grade] : 'Published'}</span>
                      ) : r.exists ? (
                        <span className="badge badge-yellow">Draft</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
