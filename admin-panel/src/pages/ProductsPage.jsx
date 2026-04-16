import { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Pencil, Trash2, X, ImagePlus } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', category: 'curd', unit: '', price: '', description: '', images: [],
  });
  const [imageInput, setImageInput] = useState('');

  const categories = ['curd', 'paneer', 'butter_milk', 'ghee', 'butter', 'lassi', 'cream', 'cheese'];

  function loadProducts() {
    setLoading(true);
    api.get('/products/all')
      .then((res) => setProducts(res.data.data.products))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadProducts(); }, []);

  function resetForm() {
    setForm({ name: '', category: 'curd', unit: '', price: '', description: '', images: [] });
    setImageInput('');
    setEditing(null);
    setShowForm(false);
  }

  function addImageUrl() {
    const url = imageInput.trim();
    if (!url) return;
    setForm((f) => ({ ...f, images: [...f.images, url] }));
    setImageInput('');
  }

  function removeImage(idx) {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, price: parseFloat(form.price) };
    try {
      if (editing) {
        await api.put(`/products/${editing}`, payload);
      } else {
        await api.post('/products', payload);
      }
      resetForm();
      loadProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save product');
    }
  }

  function startEdit(p) {
    setForm({
      name: p.name,
      category: p.category,
      unit: p.unit,
      price: String(p.price),
      description: p.description || '',
      images: Array.isArray(p.images) ? p.images : [],
    });
    setEditing(p.id);
    setShowForm(true);
  }

  async function toggleActive(p) {
    await api.put(`/products/${p.id}`, { is_active: !p.is_active });
    loadProducts();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Products</h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
          <p className="text-sm font-semibold text-gray-700">{editing ? 'Edit Product' : 'New Product'}</p>

          {/* Basic fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
              required
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {categories.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
            <input
              placeholder="Unit (e.g., 500g)"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              placeholder="Price (₹)"
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm md:col-span-2"
            />
          </div>

          {/* Image URLs */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <ImagePlus size={14} /> Product Images (paste URLs)
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageInput}
                onChange={(e) => setImageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImageUrl())}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addImageUrl}
                className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-200 whitespace-nowrap"
              >
                Add URL
              </button>
            </div>
            {form.images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {form.images.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={url}
                      alt={`img-${idx}`}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                    {idx === 0 && (
                      <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-blue-600 text-white rounded-b-lg py-0.5">
                        Main
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              {editing ? 'Update Product' : 'Create Product'}
            </button>
            <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-300">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
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
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {p.images?.[0] ? (
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="w-10 h-10 object-cover rounded-lg border border-gray-100"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                        <ImagePlus size={16} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {p.name}
                    {p.images?.length > 1 && (
                      <span className="ml-1.5 text-xs text-gray-400">{p.images.length} imgs</span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{p.category?.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{p.unit}</td>
                  <td className="px-4 py-3">₹{p.price}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {p.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => startEdit(p)} className="text-blue-600 hover:text-blue-800">
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
