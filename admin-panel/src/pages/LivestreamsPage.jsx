import { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function LivestreamsPage() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', youtube_url: '', start_time: '', end_time: '' });

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
    setForm({
      title: s.title,
      youtube_url: s.youtube_url,
      start_time: toLocal(s.start_time),
      end_time: toLocal(s.end_time),
    });
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Livestreams</h2>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700">
          <Plus size={16} /> Add Livestream
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" required />
          <input placeholder="YouTube URL" value={form.youtube_url} onChange={(e) => setForm({ ...form, youtube_url: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" required />
          <div>
            <label className="text-xs text-gray-500">Start Time</label>
            <input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" required />
          </div>
          <div>
            <label className="text-xs text-gray-500">End Time</label>
            <input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" required />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">{editing ? 'Update' : 'Create'}</button>
            <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-500">Loading...</p> : streams.length === 0 ? (
        <p className="text-gray-500">No livestreams configured.</p>
      ) : (
        <div className="space-y-3">
          {streams.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-800">{s.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{s.youtube_url}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(s)} className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => startEdit(s)} className="text-blue-600 hover:text-blue-800"><Pencil size={15} /></button>
                <button onClick={() => deleteStream(s.id)} className="text-red-600 hover:text-red-800"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
