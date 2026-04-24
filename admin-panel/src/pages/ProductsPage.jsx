import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Plus, Pencil, Trash2, X, ImagePlus, Upload, AlertTriangle } from 'lucide-react';

const CATEGORIES = ['curd', 'paneer', 'butter_milk', 'ghee', 'butter', 'lassi', 'cream', 'cheese'];

const EMPTY_FORM = {
  name: '', category: 'curd', unit: '', price: '', description: '',
};

export default function ProductsPage() {
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);   // product id being edited
  const [form, setForm]           = useState(EMPTY_FORM);

  // Image state
  const [existingImages, setExistingImages] = useState([]); // URLs already on the product
  const [newFiles, setNewFiles]             = useState([]); // File objects to upload
  const [newPreviews, setNewPreviews]       = useState([]); // Object URLs for preview
  const [removedUrls, setRemovedUrls]       = useState([]); // existing URLs to delete

  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null); // product to confirm-delete
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

  // Revoke object URLs on unmount / when previews change
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
    setForm({
      name: p.name,
      category: p.category,
      unit: p.unit,
      price: String(p.price),
      description: p.description || '',
    });
    setExistingImages(Array.isArray(p.images) ? p.images : []);
    setNewFiles([]);
    setNewPreviews([]);
    setRemovedUrls([]);
    setFormError('');
    setEditing(p.id);
    setShowForm(true);
  }

  function handleFileChange(e) {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;

    const valid = picked.filter((f) => /\.(jpe?g|png)$/i.test(f.name));
    if (valid.length !== picked.length) {
      setFormError('Only JPG and PNG files are allowed.');
    } else {
      setFormError('');
    }

    const previews = valid.map((f) => URL.createObjectURL(f));
    setNewFiles((prev) => [...prev, ...valid]);
    setNewPreviews((prev) => [...prev, ...previews]);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }

  function removeNewFile(idx) {
    URL.revokeObjectURL(newPreviews[idx]);
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
    setNewPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeExistingImage(url) {
    setExistingImages((prev) => prev.filter((u) => u !== url));
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
      newFiles.forEach((f) => fd.append('images', f));

      if (editing) {
        if (removedUrls.length > 0) {
          fd.append('remove_images', JSON.stringify(removedUrls));
        }
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
      const fd = new FormData();
      fd.append('is_active', String(!p.is_active));
      await api.put(`/products/${p.id}`, fd);
      loadProducts();
    } catch (err) {
      console.error(err);
    }
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
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Products</h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-5"
        >
          <p className="text-sm font-semibold text-gray-700">
            {editing ? 'Edit Product' : 'New Product'}
          </p>

          {/* Basic fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <input
              placeholder="Unit (e.g. 500g) *"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              placeholder="Price (₹) *"
              type="number"
              step="0.01"
              min="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm md:col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ── Image upload ─────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                <ImagePlus size={14} />
                Product Images
                <span className="text-gray-400 font-normal">(JPG / PNG · max 5 MB each · up to 10)</span>
              </p>
              {totalImages > 0 && (
                <span className="text-xs text-gray-400">{totalImages} / 10</span>
              )}
            </div>

            {/* Drop zone / picker */}
            {totalImages < 10 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
              >
                <Upload size={22} />
                <span className="text-sm font-medium">Click to upload images</span>
                <span className="text-xs">JPG or PNG</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Image grid */}
            {(existingImages.length > 0 || newPreviews.length > 0) && (
              <div className="flex flex-wrap gap-3 mt-3">
                {/* Existing images (already on server) */}
                {existingImages.map((url, idx) => (
                  <div key={`ex-${idx}`} className="relative group w-20 h-20">
                    <img
                      src={url}
                      alt=""
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                      onError={(e) => { e.target.src = ''; }}
                    />
                    {idx === 0 && (
                      <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-blue-600 text-white rounded-b-lg py-0.5">
                        Main
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeExistingImage(url)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}

                {/* New files (local preview) */}
                {newPreviews.map((src, idx) => (
                  <div key={`new-${idx}`} className="relative group w-20 h-20">
                    <img
                      src={src}
                      alt=""
                      className="w-20 h-20 object-cover rounded-lg border-2 border-blue-300"
                    />
                    <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-blue-500 text-white rounded-b-lg py-0.5">
                      New
                    </span>
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
            )}
          </div>

          {/* Error */}
          {formError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertTriangle size={14} /> {formError}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : editing ? 'Update Product' : 'Create Product'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Product table ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 h-14 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          No products yet. Click "Add Product" to create one.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Image</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Unit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Price</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  {/* Thumbnail */}
                  <td className="px-4 py-3">
                    {p.images?.[0] ? (
                      <div className="relative w-10 h-10">
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-10 h-10 object-cover rounded-lg border border-gray-100"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        {p.images.length > 1 && (
                          <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            {p.images.length}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                        <ImagePlus size={16} />
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 capitalize text-gray-600">{p.category?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-gray-600">{p.unit}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">₹{p.price}</td>

                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                        p.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {p.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>

                  {/* Edit + Delete */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => startEdit(p)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Delete confirmation modal ───────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Delete Product?</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  <span className="font-medium text-gray-700">"{deleteTarget.name}"</span> will be
                  permanently removed along with all its images. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
