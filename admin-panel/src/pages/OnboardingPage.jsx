import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
  Plus, Pencil, Trash2, X, Sparkles, AlertTriangle, Check, Upload,
  ChevronUp, ChevronDown, EyeOff, Image as ImageIcon, Smartphone,
} from 'lucide-react';

// The onboarding pages render full-screen in the app: a tall image fills the
// top, with the headline + description overlaid near the bottom. Portrait
// images (roughly 9:16) look best.
const RATIO = '9 / 16';
const RECOMMEND = '1080 × 1920 px';

export default function OnboardingPage() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [existingImage, setExistingImage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [orderError, setOrderError] = useState('');
  const fileInputRef = useRef(null);

  function load() {
    setLoading(true);
    api.get('/onboarding')
      .then((res) => {
        setPages(res.data.data.pages || []);
        setOrderError('');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  function resetForm() {
    setEditingId(null);
    setHeadline('');
    setDescription('');
    setIsActive(true);
    setExistingImage('');
    setImageFile(null);
    setImagePreview('');
    setFormError('');
  }

  function openAdd() { resetForm(); setShowForm(true); }

  function openEdit(page) {
    resetForm();
    setEditingId(page.id);
    setHeadline(page.headline || '');
    setDescription(page.description || '');
    setIsActive(page.is_active !== false);
    setExistingImage(page.image_url || '');
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); resetForm(); }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!editingId && !imageFile) {
      setFormError('Please choose an image for this page.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const data = new FormData();
      data.append('headline', headline.trim());
      data.append('description', description.trim());
      data.append('is_active', String(isActive));
      if (imageFile) data.append('image', imageFile);
      if (editingId) {
        await api.put(`/onboarding/${editingId}`, data);
      } else {
        await api.post('/onboarding', data);
      }
      closeForm();
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save page.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/onboarding/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete page.');
    } finally {
      setDeleting(false);
    }
  }

  async function movePage(index, offset) {
    const newIndex = index + offset;
    if (reordering || newIndex < 0 || newIndex >= pages.length) return;
    const previous = pages;
    const reordered = [...pages];
    const [page] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, page);

    setPages(reordered);
    setOrderError('');
    setReordering(true);
    try {
      const res = await api.put('/onboarding/order', {
        page_ids: reordered.map((p) => p.id),
      });
      setPages(res.data.data.pages || reordered);
    } catch (err) {
      setPages(previous);
      setOrderError(err.response?.data?.error || 'Failed to update the page order.');
    } finally {
      setReordering(false);
    }
  }

  const visibleImage = imagePreview || existingImage;
  const activeCount = pages.filter((p) => p.is_active !== false).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Registration Onboarding</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            The swipeable intro shown to users on new registration. Add any number of pages — each with its own image, headline and description.
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary btn-sm sm:btn shrink-0">
          <Plus size={15} />
          <span className="hidden sm:inline">Add Page</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="card p-3 sm:p-4 flex items-start gap-3 bg-blue-50/50 border-blue-100">
        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
          <Smartphone size={17} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Full-screen portrait pages · recommended {RECOMMEND} (9 : 16)
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            The image fills the screen; the headline and description are overlaid near the bottom. Keep the lower third of the image relatively clear so the text stays readable.
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {activeCount} active {activeCount === 1 ? 'page' : 'pages'} will be shown, in the order below.
          </p>
        </div>
      </div>

      {showForm && (
        <div className="card p-4 sm:p-5 animate-scale-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Sparkles size={15} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-800">
              {editingId ? 'Edit Page' : 'New Page'}
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-wrap items-center gap-1.5 mb-2">
                <Upload size={13} />
                Page Image
                <span className="text-slate-400 font-normal normal-case tracking-normal">
                  Portrait 9 : 16 · recommended {RECOMMEND} · JPG / PNG / WEBP
                </span>
              </label>
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div
                  className="w-40 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0"
                  style={{ aspectRatio: RATIO }}
                >
                  {visibleImage ? (
                    <img src={visibleImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={26} className="text-slate-300" />
                  )}
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary">
                  <Upload size={15} />
                  {visibleImage ? 'Change Image' : 'Upload Image'}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                Headline <span className="text-slate-400 font-normal normal-case">(optional)</span>
              </label>
              <input
                placeholder="e.g. Fresh milk, delivered daily"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="input"
                maxLength={60}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                Description <span className="text-slate-400 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                placeholder="A short line describing this page…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input min-h-[80px] resize-y"
                maxLength={160}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer w-fit">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active (shown in the app)
            </label>

            {formError && (
              <div className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertTriangle size={13} />
                {formError}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="submit" disabled={saving} className="btn-primary justify-center sm:justify-start disabled:opacity-60">
                {saving
                  ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Check size={15} />}
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={closeForm} className="btn-secondary justify-center sm:justify-start">
                <X size={15} />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {orderError && (
        <div className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertTriangle size={13} />
          {orderError}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-64 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <div className="card p-10 sm:p-16 text-center">
          <Sparkles size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No onboarding pages yet</p>
          <p className="text-slate-400 text-sm mt-1">Add your first page above to build the intro flow.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((page, index) => (
            <div key={page.id} className="card p-3">
              <div
                className="w-full rounded-lg overflow-hidden bg-slate-100 border border-slate-100 relative"
                style={{ aspectRatio: RATIO }}
              >
                {page.image_url ? (
                  <img src={page.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={22} className="text-slate-300" />
                  </div>
                )}
                {/* Text overlay preview — mirrors how it renders in the app */}
                {(page.headline || page.description) && (
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                    {page.headline && (
                      <p className="text-white text-sm font-bold leading-tight">{page.headline}</p>
                    )}
                    {page.description && (
                      <p className="text-white/80 text-[11px] mt-0.5 line-clamp-2">{page.description}</p>
                    )}
                  </div>
                )}
                {page.is_active === false && (
                  <span className="absolute top-2 left-2 text-[10px] font-semibold bg-slate-800/80 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                    <EyeOff size={10} /> Hidden
                  </span>
                )}
                <span className="absolute top-2 right-2 text-[10px] font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                  #{index + 1}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-end gap-1">
                <button
                  onClick={() => movePage(index, -1)}
                  disabled={reordering || index === 0}
                  className="btn-icon p-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  onClick={() => movePage(index, 1)}
                  disabled={reordering || index === pages.length - 1}
                  className="btn-icon p-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ChevronDown size={15} />
                </button>
                <button onClick={() => openEdit(page)} className="btn-icon" title="Edit">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(page)}
                  className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
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
                <p className="font-semibold text-slate-800">Delete Page?</p>
                <p className="text-sm text-slate-500 mt-1">
                  This onboarding page will be permanently removed.
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
