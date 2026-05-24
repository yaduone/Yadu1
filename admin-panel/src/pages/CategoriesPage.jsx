import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
  Plus, Pencil, Trash2, X, Tag, AlertTriangle, Check, ImagePlus, Upload,
} from 'lucide-react';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [labelInput, setLabelInput] = useState('');
  const [existingImage, setExistingImage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  function load() {
    setLoading(true);
    api.get('/categories')
      .then((res) => setCategories(res.data.data.categories || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);
  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  function resetImageState(image = '') {
    setExistingImage(image);
    setImageFile(null);
    setImagePreview('');
    setRemoveImage(false);
  }

  function openAdd() {
    setEditingId(null);
    setLabelInput('');
    resetImageState();
    setFormError('');
    setShowForm(true);
  }

  function openEdit(category) {
    setEditingId(category.id);
    setLabelInput(category.label);
    resetImageState(category.image_url || '');
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setLabelInput('');
    resetImageState();
    setFormError('');
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(jpe?g|png)$/i.test(file.name)) {
      setFormError('Only JPG and PNG files are allowed.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveImage(false);
    setFormError('');
  }

  function removeSelectedImage() {
    setImageFile(null);
    setImagePreview('');
    setRemoveImage(Boolean(existingImage));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!labelInput.trim()) {
      setFormError('Label is required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const data = new FormData();
      data.append('label', labelInput.trim());
      if (imageFile) data.append('image', imageFile);
      if (removeImage && !imageFile) data.append('remove_image', 'true');
      if (editingId) {
        await api.put(`/categories/${editingId}`, data);
      } else {
        await api.post('/categories', data);
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

  const visibleImage = imagePreview || (!removeImage ? existingImage : '');

  return (
    <div className="space-y-5">
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

      {showForm && (
        <div className="card p-5 animate-scale-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Tag size={15} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-800">
              {editingId ? 'Edit Category' : 'New Category'}
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                autoFocus
                placeholder="e.g. Paneer"
                value={labelInput}
                onChange={(event) => setLabelInput(event.target.value)}
                className="input"
              />
              {editingId && (
                <p className="text-[11px] text-slate-400 mt-1">
                  The display label can change while the internal slug remains stable for assigned products.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <ImagePlus size={13} />
                Sidebar Circle Image
                <span className="text-slate-400 font-normal normal-case tracking-normal">
                  JPG / PNG - max 5 MB
                </span>
              </label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  {visibleImage ? (
                    <img src={visibleImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Tag size={24} className="text-slate-300" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary">
                    <Upload size={15} />
                    {visibleImage ? 'Change Image' : 'Upload Image'}
                  </button>
                  {visibleImage && (
                    <button type="button" onClick={removeSelectedImage} className="btn-secondary text-red-500">
                      <X size={15} />
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>

            {formError && (
              <div className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertTriangle size={13} />
                {formError}
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary shrink-0 disabled:opacity-60">
                {saving
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Check size={15} />}
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={closeForm} className="btn-secondary shrink-0">
                <X size={15} />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

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
                <th>Image</th>
                <th>Label</th>
                <th>Slug</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-100 flex items-center justify-center">
                      {category.image_url ? (
                        <img src={category.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Tag size={18} className="text-slate-300" />
                      )}
                    </div>
                  </td>
                  <td className="font-semibold text-slate-800 capitalize">{category.label}</td>
                  <td>
                    <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                      {category.slug}
                    </code>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(category)} className="btn-icon" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(category)}
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
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</>
                  : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
