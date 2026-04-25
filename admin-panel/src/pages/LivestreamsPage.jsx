import { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Pencil, Trash2, Radio, ToggleLeft, ToggleRight } from 'lucide-react';

export default function LivestreamsPage() {
  const [streams, setStreams]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState({ title: '', youtube_url: '', start_time: '', end_time: '' });

  function loadStreams() {
    setLoading(true);
    api.get('/livestreams/admin/list')
      .then((res) => setStreams(res.data.data.livestreams))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadStreams(); }, []);

  function resetForm() {
    setForm({ title: '', youtube_url: '', start_time: '', end_time: '' });
    setEditing(null);
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/livestreams/${editing}`, form);
      } else {
        await api.post('/livestreams', form);
      }
      resetForm();
      loadStreams();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  function startEdit(s) {
    const toLocal = (t) => {
      if (!t) return '';
      const d = t.toDate ? t.toDate() : new Date(t._seconds ? t._seconds * 1000 : t);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };
    setForm({ title: s.title, youtube_url: s.youtube_url, start_time: toLocal(s.start_time), end_time: toLocal(s.end_time) });
    setEditing(s.id);
    setShowForm(true);
  }

  async function toggleActive(s) {
    await api.put(`/livestreams/${s.id}`, { is_active: !s.is_active });
    loadStreams();
  }

  async function deleteStream(id) {
    if (!confirm('Delete this livestream?')) return;
    await api.delete(`/livestreams/${id}`);
    loadStreams();
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Livestreams</h2>
          <p className="text-xs text-slate-400 mt-0.5">{streams.length} streams configured</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="btn-primary">
          <Plus size={16} />
          {showForm ? 'Cancel' : 'Add Livestream'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 animate-scale-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
              <Radio size={15} className="text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-800">{editing ? 'Edit Livestream' : 'New Livestream'}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Title</label>
              <input placeholder="Stream title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">YouTube URL</label>
              <input placeholder="https://youtube.com/..." value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Start Time</label>
              <input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">End Time</label>
              <input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="input" required />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
            <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-slate-50" />)}
        </div>
      ) : streams.length === 0 ? (
        <div className="card p-16 text-center">
          <Radio size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No livestreams configured</p>
          <p className="text-slate-400 text-sm mt-1">Add a livestream to broadcast to your customers.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {streams.map((s) => (
            <div key={s.id} className="card p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.is_active ? 'bg-red-50' : 'bg-slate-100'}`}>
                  <Radio size={18} className={s.is_active ? 'text-red-500' : 'text-slate-400'} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{s.title}</p>
                  <p className="text-xs text-slate-400 truncate">{s.youtube_url}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(s)}
                  className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${s.is_active ? 'text-emerald-600' : 'text-slate-400'}`}
                >
                  {s.is_active
                    ? <ToggleRight size={20} className="text-emerald-500" />
                    : <ToggleLeft size={20} className="text-slate-300" />
                  }
                  {s.is_active ? 'Live' : 'Off'}
                </button>
                <button onClick={() => startEdit(s)} className="btn-icon"><Pencil size={14} /></button>
                <button onClick={() => deleteStream(s.id)} className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
