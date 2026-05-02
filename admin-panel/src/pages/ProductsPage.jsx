import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
  Plus, Pencil, Trash2, X, ImagePlus, Upload,
  AlertTriangle, Package, ToggleLeft, ToggleRight,
} from 'lucide-react';

const CATEGORIES = ['curd', 'paneer', 'butter_milk', 'ghee', 'butter', 'lassi', 'cream', 'cheese'];

const EMPTY_FORM = {
  name: '', category: 'curd', unit: '', price: '', description: '', cover_image: '',
};

export default function ProductsPage() {
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);

  const [existingImages, setExistingImages] = useState([]);
  const [newFiles, setNewFiles]             = useState([]);
  const [newPreviews, setNewPreviews]       = useState([]);
  const [removedUrls, setRemovedUrls]       = useState([]);

  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const fileInputRef = useRef(null);

  function loadProducts() {
    setLoading(true);
    api.get('/products/all')
      .then((res) => setProducts(res.data.data.products || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => {
    return () => newPreviews.forEach((p) => URL.revokeObjectURL(p));
  }, [newPreviews]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setExistingImages([]);
    setNewFiles([]);
    setNewPreviews((prev) => { prev.forEach((p) => URL.revokeObjectURL(p)); return []; });
    setRemovedUrls([]);
    setFormError('');
    setShowForm(false);
  }

  function startEdit(p) {
    const imgs = Array.isArray(p.images) ? p.images : [];
    setForm({ name: p.name, category: p.category, unit: p.unit, price: String(p.price), description: p.description || '', cover_image: p.cover_image || imgs[0] || '' });
    setExistingImages(imgs);
    setNewFiles([]); setNewPreviews([]); setRemovedUrls([]); setFormError('');
    setEditing(p.id);
    setShowForm(true);
    setTimeout(() => document.getElementById('product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function handleFileChange(e) {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const valid = picked.filter((f) => /\.(jpe?g|png)$/i.test(f.name));
    if (valid.length !== picked.length) setFormError('Only JPG and PNG files are allowed.');
    else setFormError('');
    const previews = valid.map((f) => URL.createObjectURL(f));
    setNewFiles((prev) => [...prev, ...valid]);
    setNewPreviews((prev) => [...prev, ...previews]);
    e.target.value = '';
  }

  function removeNewFile(idx) {
    URL.revokeObjectURL(newPreviews[idx]);
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
    setNewPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeExistingImage(url) {
    setExistingImages((prev) => {
      const next = prev.filter((u) => u !== url);
      // If removed image was the cover, auto-assign to first remaining
      if (form.cover_image === url) {
        setForm((f) => ({ ...f, cover_image: next[0] || '' }));
      }
      return next;
    });
    setRemovedUrls((prev) => [...prev, url]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim() || !form.unit.trim() || !form.price) {
      setFormError('Name, unit, and price are required.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('category', form.category);
      fd.append('unit', form.unit.trim());
      fd.append('price', form.price);
      fd.append('description', form.description.trim());
      if (form.cover_image) fd.append('cover_image', form.cover_image);
      newFiles.forEach((f) => fd.append('images', f));
      if (editing) {
        if (removedUrls.length > 0) fd.append('remove_images', JSON.stringify(removedUrls));
        await api.put(`/products/${editing}`, fd);
      } else {
        await api.post('/products', fd);
      }
      resetForm();
      loadProducts();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p) {
    try {
      await api.put(`/products/${p.id}`, { is_active: !p.is_active });
      loadProducts();
    } catch (err) { console.error(err); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete product.');
    } finally {
      setDeleting(false);
    }
  }

  const totalImages = existingImages.length + newFiles.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Products</h2>
          <p className="text-xs text-slate-400 mt-0.5">{products.length} products total</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="btn-primary btn-sm sm:btn shrink-0"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Add Product</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div id="product-form" className="card p-6 animate-scale-in">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Package size={16} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-800">
              {editing ? 'Edit Product' : 'New Product'}
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Name *</label>
                <input
                  placeholder="e.g. Fresh Curd"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="select"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Unit *</label>
                <input
                  placeholder="e.g. 500g"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Price (₹) *</label>
                <input
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
                <input
                  placeholder="Short product description (optional)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            {/* Image upload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <ImagePlus size={13} />
                  Product Images
                  <span className="text-slate-400 font-normal normal-case tracking-normal">JPG / PNG · max 5 MB · up to 10</span>
                </label>
                {totalImages > 0 && (
                  <span className="text-xs text-slate-400 font-medium">{totalImages} / 10</span>
                )}
              </div>

              {totalImages < 10 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-7 flex flex-col items-center gap-2 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/40 transition-all"
                >
                  <Upload size={22} />
                  <span className="text-sm font-medium">Click to upload images</span>
                  <span className="text-xs">JPG or PNG</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png" multiple className="hidden" onChange={handleFileChange} />

              {(existingImages.length > 0 || newPreviews.length > 0) && (
                <div className="mt-3 space-y-2">
                  {existingImages.length > 0 && (
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      Click an image to set as cover
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {existingImages.map((url, idx) => {
                      const isCover = form.cover_image === url || (!form.cover_image && idx === 0);
                      return (
                        <div
                          key={`ex-${idx}`}
                          className={`relative group w-20 h-20 cursor-pointer rounded-xl transition-all ${isCover ? 'ring-2 ring-blue-500 ring-offset-1' : 'hover:ring-2 hover:ring-slate-300 hover:ring-offset-1'}`}
                          onClick={() => setForm((f) => ({ ...f, cover_image: url }))}
                        >
                          <img src={url} alt="" className="w-20 h-20 object-cover rounded-xl border border-slate-100" onError={(e) => { e.target.src = ''; }} />
                          <span className={`absolute bottom-0 left-0 right-0 text-center text-[9px] rounded-b-xl py-0.5 ${isCover ? 'bg-blue-600 text-white' : 'bg-slate-600/60 text-white opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                            {isCover ? 'Cover' : 'Set cover'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeExistingImage(url); }}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      );
                    })}
                    {newPreviews.map((src, idx) => (
                      <div key={`new-${idx}`} className="relative group w-20 h-20">
                        <img src={src} alt="" className="w-20 h-20 object-cover rounded-xl border-2 border-blue-300" />
                        <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-blue-500 text-white rounded-b-xl py-0.5">New</span>
                        <button
                          type="button"
                          onClick={() => removeNewFile(idx)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <AlertTriangle size={14} className="shrink-0" />
                {formError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : editing ? 'Update Product' : 'Create Product'}
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card h-14 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="card p-16 text-center">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No products yet</p>
          <p className="text-slate-400 text-sm mt-1">Click "Add Product" to create your first one.</p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="space-y-2 sm:hidden">
            {[...products].sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0)).map((p) => (
              <div key={p.id} className={`card p-4 ${!p.is_active ? 'opacity-80' : ''}`}>
                <div className="flex items-center gap-3">
                  {p.cover_image || p.images?.[0] ? (
                    <div className="relative w-12 h-12 rounded-xl shrink-0 overflow-hidden border border-slate-100">
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className={`w-12 h-12 object-cover ${!p.is_active ? 'blur-[2px]' : ''}`}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      {!p.is_active && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                          <span className="text-white text-[8px] font-bold text-center leading-tight px-0.5">Coming<br/>Soon</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                      <ImagePlus size={18} className="text-slate-300" />
                      {!p.is_active && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                          <span className="text-white text-[8px] font-bold text-center leading-tight px-0.5">Coming<br/>Soon</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                      <span className="font-bold text-slate-800 shrink-0">₹{p.price}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="badge badge-blue capitalize">{p.category?.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-slate-400">{p.unit}</span>
                      <button
                        onClick={() => toggleActive(p)}
                        className={`text-xs font-semibold flex items-center gap-1 ${p.is_active ? 'text-emerald-600' : 'text-slate-400'}`}
                      >
                        {p.is_active
                          ? <ToggleRight size={16} className="text-emerald-500" />
                          : <ToggleLeft size={16} className="text-slate-300" />
                        }
                        {p.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => startEdit(p)} className="btn-icon" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteTarget(p)} className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="card overflow-hidden hidden sm:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...products].sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0)).map((p) => (
                  <tr key={p.id} className={!p.is_active ? 'opacity-80' : ''}>
                    <td>
                      {p.cover_image || p.images?.[0] ? (
                        <div className="relative w-10 h-10 rounded-xl overflow-hidden">
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            className={`w-10 h-10 object-cover border border-slate-100 ${!p.is_active ? 'blur-[2px]' : ''}`}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          {p.is_active && p.images.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                              {p.images.length}
                            </span>
                          )}
                          {!p.is_active && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                              <span className="text-white text-[7px] font-bold text-center leading-tight">Coming<br/>Soon</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 overflow-hidden">
                          <ImagePlus size={16} />
                          {!p.is_active && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                              <span className="text-white text-[7px] font-bold text-center leading-tight">Coming<br/>Soon</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="font-semibold text-slate-800">{p.name}</td>
                    <td>
                      <span className="badge badge-blue capitalize">{p.category?.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="text-slate-500">{p.unit}</td>
                    <td className="font-semibold text-slate-800">₹{p.price}</td>
                    <td>
                      <button
                        onClick={() => toggleActive(p)}
                        className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                          p.is_active ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        {p.is_active
                          ? <ToggleRight size={20} className="text-emerald-500" />
                          : <ToggleLeft size={20} className="text-slate-300" />
                        }
                        {p.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(p)} className="btn-icon" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
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
        </>
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
                <p className="font-semibold text-slate-800">Delete Product?</p>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-medium text-slate-700">"{deleteTarget.name}"</span> will be permanently removed along with all its images. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="btn-secondary">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="btn-danger disabled:opacity-60">
                {deleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting…
                  </>
                ) : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
