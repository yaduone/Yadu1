import { useState, useEffect } from 'react';
import api from '../services/api';
import SearchField from '../components/SearchField';
import { matchesSearch } from '../utils/search';
import { Plus, Pencil, Trash2, Radio, Droplets, CalendarClock, Sun, Moon, Ban } from 'lucide-react';

const STATUS_BADGES = {
  scheduled: 'badge badge-blue',
  live: 'badge badge-red',
  completed: 'badge badge-green',
  cancelled: 'badge badge-gray',
  inactive: 'badge badge-gray',
};

function initialForm() {
  const start = new Date(Date.now() + 35 * 60 * 1000);
  start.setSeconds(0, 0);
  const localStart = new Date(start.getTime() - start.getTimezoneOffset() * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  return { title: '', youtube_url: '', slot: 'morning', scheduled_start_at: localStart, duration_minutes: '60' };
}

function localDateTimeValue(isoValue) {
  if (!isoValue) return initialForm().scheduled_start_at;
  const date = new Date(isoValue);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16);
}

function formatSchedule(isoValue) {
  if (!isoValue) return 'Immediate legacy stream';
  return new Date(isoValue).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function LivestreamsPage() {
  const [streams, setStreams]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(() => initialForm());

  // Lactometer state — morning slot
  const [morningReading, setMorningReading] = useState('');
  const [morningCurrent, setMorningCurrent] = useState(undefined);
  const [morningSaving, setMorningSaving]   = useState(false);
  const [morningMsg, setMorningMsg]         = useState('');

  // Lactometer state — evening slot
  const [eveningReading, setEveningReading] = useState('');
  const [eveningCurrent, setEveningCurrent] = useState(undefined);
  const [eveningSaving, setEveningSaving]   = useState(false);
  const [eveningMsg, setEveningMsg]         = useState('');

  function loadStreams() {
    setLoading(true);
    api.get('/livestreams/admin/list')
      .then((res) => setStreams(res.data.data.livestreams))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadStreams(); }, []);

  useEffect(() => {
    api.get('/livestreams/lactometer/admin')
      .then((res) => {
        const d = res.data.data;
        setMorningCurrent(d.lactometer_morning);
        setEveningCurrent(d.lactometer_evening);
      })
      .catch(() => {});
  }, []);

  function resetForm() {
    setForm(initialForm());
    setEditing(null);
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        scheduled_start_at: new Date(form.scheduled_start_at).toISOString(),
        duration_minutes: Number(form.duration_minutes),
      };
      if (editing) {
        await api.put(`/livestreams/${editing}`, payload);
      } else {
        await api.post('/livestreams', payload);
      }
      resetForm();
      loadStreams();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  function startEdit(s) {
    setForm({
      title: s.title || '',
      youtube_url: s.youtube_url || '',
      slot: s.slot || 'morning',
      scheduled_start_at: localDateTimeValue(s.scheduled_start_at),
      duration_minutes: String(s.duration_minutes || 60),
    });
    setEditing(s.id);
    setShowForm(true);
  }

  async function cancelStream(s) {
    if (!confirm(`Cancel the ${s.slot || ''} livestream schedule?`)) return;
    await api.put(`/livestreams/${s.id}`, { status: 'cancelled' });
    loadStreams();
  }

  async function deleteStream(id) {
    if (!confirm('Delete this livestream?')) return;
    await api.delete(`/livestreams/${id}`);
    loadStreams();
  }

  async function handleSlotSave(slot) {
    const reading  = slot === 'morning' ? morningReading : eveningReading;
    const setSaving = slot === 'morning' ? setMorningSaving : setEveningSaving;
    const setMsg    = slot === 'morning' ? setMorningMsg   : setEveningMsg;
    const setCurrent = slot === 'morning' ? setMorningCurrent : setEveningCurrent;
    const setInput   = slot === 'morning' ? setMorningReading : setEveningReading;

    if (!reading) return;
    setSaving(true);
    setMsg('');
    try {
      await api.put('/livestreams/lactometer', { slot, reading });
      setCurrent(parseFloat(reading));
      setInput('');
      setMsg('Updated successfully');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function handleSlotNA(slot) {
    const setSaving  = slot === 'morning' ? setMorningSaving  : setEveningSaving;
    const setMsg     = slot === 'morning' ? setMorningMsg     : setEveningMsg;
    const setCurrent = slot === 'morning' ? setMorningCurrent : setEveningCurrent;

    setSaving(true);
    setMsg('');
    try {
      await api.put('/livestreams/lactometer', { slot, is_na: true });
      setCurrent(null);
      setMsg('Marked as N/A');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  const filteredStreams = streams.filter((stream) => matchesSearch(search, [
    stream.title,
    stream.youtube_url,
    stream.slot,
    stream.status || (stream.is_active ? 'live' : 'inactive'),
    formatSchedule(stream.scheduled_start_at),
  ]));

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h2 className="page-title">Livestreams</h2>
          <p className="text-xs text-slate-400 mt-0.5">{streams.length} stream schedules configured</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="btn-primary w-full justify-center sm:w-fit">
          <Plus size={16} />
          {showForm ? 'Cancel' : 'Schedule Livestream'}
        </button>
      </div>
      <div className="card p-4 flex items-start gap-3 bg-blue-50/50 border-blue-100">
        <CalendarClock size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-slate-700">Scheduled customer broadcast</p>
          <p className="text-xs text-slate-500 mt-1">
            Customers receive a device reminder 30 minutes before the selected slot. The viewing link is exposed
            only when the stream begins and closes automatically after its duration.
          </p>
        </div>
      </div>
        {/* ── Lactometer Readings ──────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Date header */}
        <div className="flex items-start gap-2">
          <Droplets size={15} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm font-semibold text-slate-700">
            Lactometer Readings —{' '}
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Morning Slot */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Droplets size={15} className="text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm">Morning Slot Lactometer Reading</p>
              <p className="text-xs text-slate-400">
                Current:{' '}
                <span className="font-semibold text-slate-600">
                  {morningCurrent === undefined ? 'Not updated yet' : morningCurrent === null ? 'N/A' : `${morningCurrent} °LR`}
                </span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_auto_auto_1fr] sm:items-center sm:gap-3">
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 26.5"
                value={morningReading}
                onChange={(e) => { setMorningReading(e.target.value); setMorningMsg(''); }}
                className="input pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">°LR</span>
            </div>
            <button
              onClick={() => handleSlotSave('morning')}
              disabled={!morningReading || morningSaving}
              className="btn-primary justify-center disabled:opacity-50"
            >
              {morningSaving ? 'Saving…' : 'Update'}
            </button>
            <button
              onClick={() => handleSlotNA('morning')}
              disabled={morningSaving}
              className="btn-secondary justify-center disabled:opacity-50"
            >
              Mark N/A
            </button>
            {morningMsg && (
              <span className={`text-xs font-medium sm:justify-self-start ${morningMsg.includes('Failed') ? 'text-red-600' : 'text-emerald-600'}`}>
                {morningMsg}
              </span>
            )}
          </div>
        </div>

        {/* Evening Slot */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <Droplets size={15} className="text-indigo-500" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm">Evening Slot Lactometer Reading</p>
              <p className="text-xs text-slate-400">
                Current:{' '}
                <span className="font-semibold text-slate-600">
                  {eveningCurrent === undefined ? 'Not updated yet' : eveningCurrent === null ? 'N/A' : `${eveningCurrent} °LR`}
                </span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_auto_auto_1fr] sm:items-center sm:gap-3">
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 26.5"
                value={eveningReading}
                onChange={(e) => { setEveningReading(e.target.value); setEveningMsg(''); }}
                className="input pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">°LR</span>
            </div>
            <button
              onClick={() => handleSlotSave('evening')}
              disabled={!eveningReading || eveningSaving}
              className="btn-primary justify-center disabled:opacity-50"
            >
              {eveningSaving ? 'Saving…' : 'Update'}
            </button>
            <button
              onClick={() => handleSlotNA('evening')}
              disabled={eveningSaving}
              className="btn-secondary justify-center disabled:opacity-50"
            >
              Mark N/A
            </button>
            {eveningMsg && (
              <span className={`text-xs font-medium sm:justify-self-start ${eveningMsg.includes('Failed') ? 'text-red-600' : 'text-emerald-600'}`}>
                {eveningMsg}
              </span>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 sm:p-5 animate-scale-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <Radio size={15} className="text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-800">{editing ? 'Edit Scheduled Livestream' : 'Schedule Livestream'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Title (optional)</label>
              <input placeholder="Morning quality check live" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">YouTube URL</label>
              <input placeholder="https://youtube.com/..." value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Delivery Slot</label>
              <select value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })} className="select">
                <option value="morning">Morning Stream</option>
                <option value="evening">Evening Stream</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Starts At</label>
              <input
                type="datetime-local"
                value={form.scheduled_start_at}
                onChange={(e) => setForm({ ...form, scheduled_start_at: e.target.value })}
                className="input"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">Schedule at least 30 minutes in advance.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Duration</label>
              <select value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} className="select">
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1 hour 30 minutes</option>
                <option value="120">2 hours</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-4 sm:flex-row">
            <button type="submit" className="btn-primary justify-center">{editing ? 'Save Schedule' : 'Schedule Stream'}</button>
            <button type="button" onClick={resetForm} className="btn-secondary justify-center">Cancel</button>
          </div>
        </form>
      )}

      {!loading && streams.length > 0 && (
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search livestreams by title, slot or status..."
        />
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-slate-50" />)}
        </div>
      ) : streams.length === 0 ? (
        <div className="card p-8 text-center sm:p-16">
          <Radio size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No livestreams scheduled</p>
          <p className="text-slate-400 text-sm mt-1">Schedule a morning or evening broadcast for your customers.</p>
        </div>
      ) : filteredStreams.length === 0 ? (
        <div className="card p-8 text-center sm:p-16">
          <Radio size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No livestreams match your search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStreams.map((s) => {
            const status = s.status || (s.is_active ? 'live' : 'inactive');
            const SlotIcon = s.slot === 'evening' ? Moon : Sun;
            return (
            <div key={s.id} className="card p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${status === 'live' ? 'bg-red-50' : 'bg-blue-50'}`}>
                  <Radio size={18} className={status === 'live' ? 'text-red-500' : 'text-blue-500'} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-800 truncate">{s.title}</p>
                    <span className={STATUS_BADGES[status] || 'badge badge-gray'}>{status}</span>
                    {s.slot && (
                      <span className="badge badge-purple">
                        <SlotIcon size={11} /> {s.slot}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatSchedule(s.scheduled_start_at)}{s.duration_minutes ? ` / ${s.duration_minutes} min` : ''}
                  </p>
                  <p className="text-xs text-slate-400 truncate mt-0.5" title={s.youtube_url}>{s.youtube_url}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 shrink-0 sm:justify-end">
                {status === 'scheduled' && (
                  <button onClick={() => startEdit(s)} className="btn-icon" title="Edit schedule"><Pencil size={14} /></button>
                )}
                {(status === 'scheduled' || status === 'live') && (
                  <button onClick={() => cancelStream(s)} className="btn-icon text-amber-500 hover:text-amber-700 hover:bg-amber-50" title="Cancel stream">
                    <Ban size={14} />
                  </button>
                )}
                {(status === 'completed' || status === 'cancelled' || status === 'inactive') && (
                  <button onClick={() => deleteStream(s.id)} className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50" title="Delete stream"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}
