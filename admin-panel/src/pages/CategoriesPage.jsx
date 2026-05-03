import { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Pencil, Trash2, X, Tag, AlertTriangle, Check } from 'lucide-react';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);

  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [labelInput, setLabelInput] = useState('');
  const [formError, setFormError]   = useState('');
  const [saving, setSaving]         = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  function load() {
    setLoading(true);
    api.get('/categories')
      .then((res) => setCategories(res.data.data.categories || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditingId(null);
    setLabelInput('');
    setFormError('');
    setShowForm(true);
  }

  function openEdit(cat) {
    setEditingId(cat.id);
    setLabelInput(cat.label);
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setLabelInput('');
    setFormError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!labelInput.trim()) { setFormError('Label is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await api.put(`/categories/${editingId}`, { label: labelInput.trim() });
      } else {
        await api.post('/categories', { label: labelInput.trim() });
      }
      closeForm();
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/categories/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete category.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Categories</h2>
          <p className="text-xs text-slate-400 mt-0.5">{categories.length} categories</p>
        </div>
        <button onClick={openAdd} className="btn-primary btn-sm sm:btn shrink-0">
          <Plus size={15} />
          <span className="hidden sm:inline">Add Category</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="card p-5 animate-scale-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Tag size={15} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-800">{editingId ? 'Rename Category' : 'New Category'}</h3>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2 items-start">
            <div className="flex-1">
              <input
                autoFocus
                placeholder="e.g. Paneer"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                className="input"
              />
              {editingId && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Note: only the display label changes. The internal slug stays the same so existing products are not affected.
                </p>
              )}
              {formError && (
                <div className="flex items-center gap-1.5 text-sm text-red-600 mt-2">
                  <AlertTriangle size={13} />
                  {formError}
                </div>
              )}
            </div>
            <button type="submit" disabled={saving} className="btn-primary shrink-0 disabled:opacity-60">
              {saving
                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Check size={15} />}
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={closeForm} className="btn-secondary shrink-0">
              <X size={15} />
            </button>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-14 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="card p-16 text-center">
          <Tag size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No categories yet</p>
          <p className="text-slate-400 text-sm mt-1">Add your first category above.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Slug</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td className="font-semibold text-slate-800 capitalize">{cat.label}</td>
                  <td>
                    <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{cat.slug}</code>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(cat)} className="btn-icon" title="Rename">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
                        className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-scale-in">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Delete Category?</p>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-medium text-slate-700">"{deleteTarget.label}"</span> will be permanently removed.
                  Products already assigned to this category will keep their value but may appear uncategorised.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="btn-secondary">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} className="btn-danger disabled:opacity-60">
                {deleting
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting…</>
                  : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
