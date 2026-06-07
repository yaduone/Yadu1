import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import SearchField from '../components/SearchField';
import { matchesSearch } from '../utils/search';
import {
  AlertTriangle, FileText, Loader2, Pencil, Plus, Save, Trash2, X,
} from 'lucide-react';

const EMPTY_FORM = { title: '', body: '' };

function formatDate(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/notes');
      setNotes(res.data.data.notes || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load notes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(note) {
    setEditingId(note.id);
    setForm({ title: note.title || '', body: note.body || '' });
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (!form.body.trim()) {
      setFormError('Note is required.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
      };
      if (editingId) {
        const res = await api.put(`/notes/${editingId}`, payload);
        const updated = res.data.data.note;
        setNotes((prev) => prev.map((note) => (note.id === editingId ? updated : note)));
      } else {
        const res = await api.post('/notes', payload);
        const created = res.data.data.note;
        setNotes((prev) => [created, ...prev]);
      }
      closeForm();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/notes/${deleteTarget.id}`);
      setNotes((prev) => prev.filter((note) => note.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete note.');
    } finally {
      setDeleting(false);
    }
  }

  const filteredNotes = notes.filter((note) =>
    matchesSearch(search, [note.title, note.body])
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Notes</h2>
          <p className="text-xs text-slate-400 mt-0.5">{notes.length} notes saved</p>
        </div>
        <button onClick={openAdd} className="btn-primary btn-sm sm:btn shrink-0">
          <Plus size={15} />
          <span className="hidden sm:inline">Add Note</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {showForm && (
        <div className="card p-4 sm:p-5 animate-scale-in">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <FileText size={15} className="text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-800">
                {editingId ? 'Edit Note' : 'New Note'}
              </h3>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="btn-icon text-slate-400 hover:text-slate-600"
              aria-label="Close note form"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                Title
              </label>
              <input
                autoFocus
                className="input"
                value={form.title}
                maxLength={120}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                Note
              </label>
              <textarea
                className="input min-h-36 resize-y"
                value={form.body}
                maxLength={5000}
                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              />
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <AlertTriangle size={14} className="shrink-0" />
                {formError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    Save Note
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {!loading && notes.length > 0 && (
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search notes..."
        />
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="card p-4 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-3" />
              <div className="space-y-2">
                <div className="h-3 bg-slate-100 rounded" />
                <div className="h-3 bg-slate-100 rounded w-4/5" />
                <div className="h-3 bg-slate-100 rounded w-3/5" />
              </div>
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No notes yet</p>
          <button onClick={openAdd} className="btn-primary btn-sm mt-4">
            <Plus size={14} />
            Add Note
          </button>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No notes match your search.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredNotes.map((note) => (
            <div key={note.id} className="card p-4 flex flex-col min-h-48">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-800 truncate">{note.title}</h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Updated {formatDate(note.updated_at || note.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(note)}
                    className="btn-icon text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                    title="Edit note"
                    aria-label={`Edit ${note.title}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(note)}
                    className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"
                    title="Delete note"
                    aria-label={`Delete ${note.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed whitespace-pre-wrap break-words">
                {note.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-scale-in">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Delete Note?</p>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-medium text-slate-700">{deleteTarget.title}</span>
                  {' '}will be permanently removed.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="btn-danger disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Deleting
                  </>
                ) : 'Delete Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
