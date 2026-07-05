import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
  Plus, Pencil, Trash2, X, Images, AlertTriangle, Check, Upload,
  ChevronUp, ChevronDown, EyeOff, Home, Zap, Radio,
} from 'lucide-react';

// Per-location config: label, icon, and the aspect-ratio guidance shown on upload.
// Ratios match how each carousel renders in the app (images are NOT validated —
// this is guidance only so uploads can be any size).
const LOCATIONS = [
  {
    key: 'home_scheduled',
    label: 'Home · Scheduled',
    icon: Home,
    ratio: '2 : 1',
    recommend: '1200 × 600 px',
    hint: 'Hero carousel on the Home (Scheduled) screen. Full-width, rounded 14px corners, cover-cropped.',
  },
  {
    key: 'home_instant',
    label: 'Home · Instant',
    icon: Zap,
    ratio: '2.1 : 1',
    recommend: '1050 × 500 px',
    hint: 'Banner carousel on the Home (Instant) store screen. Full-width, rounded 18px corners, cover-cropped.',
  },
  {
    key: 'livestream',
    label: 'Livestream',
    icon: Radio,
    ratio: '2 : 1',
    recommend: '1200 × 600 px',
    hint: 'Info carousel on the Livestream screen. Full-width, rounded 16px corners, shown in full (not cropped).',
  },
];

const emptyGroups = () =>
  LOCATIONS.reduce((acc, l) => ({ ...acc, [l.key]: [] }), {});

export default function CarouselsPage() {
  const [groups, setGroups] = useState(emptyGroups());
  const [activeLoc, setActiveLoc] = useState(LOCATIONS[0].key);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [titleInput, setTitleInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
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

  const loc = LOCATIONS.find((l) => l.key === activeLoc);
  const slides = groups[activeLoc] || [];

  function load() {
    setLoading(true);
    api.get('/carousels')
      .then((res) => {
        setGroups({ ...emptyGroups(), ...(res.data.data.carousels || {}) });
        setOrderError('');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  function resetForm() {
    setEditingId(null);
    setTitleInput('');
    setLinkInput('');
    setIsActive(true);
    setExistingImage('');
    setImageFile(null);
    setImagePreview('');
    setFormError('');
  }

  function openAdd() { resetForm(); setShowForm(true); }

  function openEdit(slide) {
    resetForm();
    setEditingId(slide.id);
    setTitleInput(slide.title || '');
    setLinkInput(slide.link_url || '');
    setIsActive(slide.is_active !== false);
    setExistingImage(slide.image_url || '');
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); resetForm(); }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    // No validation of dimensions/format — accept whatever is chosen.
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setFormError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!editingId && !imageFile) {
      setFormError('Please choose an image for the slide.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const data = new FormData();
      data.append('location', activeLoc);
      data.append('title', titleInput.trim());
      data.append('link_url', linkInput.trim());
      data.append('is_active', String(isActive));
      if (imageFile) data.append('image', imageFile);
      if (editingId) {
        await api.put(`/carousels/${editingId}`, data);
      } else {
        await api.post('/carousels', data);
      }
      closeForm();
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save slide.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/carousels/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete slide.');
    } finally {
      setDeleting(false);
    }
  }

  async function moveSlide(index, offset) {
    const newIndex = index + offset;
    if (reordering || newIndex < 0 || newIndex >= slides.length) return;
    const previous = slides;
    const reordered = [...slides];
    const [slide] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, slide);

    setGroups((g) => ({ ...g, [activeLoc]: reordered }));
    setOrderError('');
    setReordering(true);
    try {
      const res = await api.put('/carousels/order', {
        location: activeLoc,
        slide_ids: reordered.map((s) => s.id),
      });
      setGroups((g) => ({ ...g, [activeLoc]: res.data.data.slides || reordered }));
    } catch (err) {
      setGroups((g) => ({ ...g, [activeLoc]: previous }));
      setOrderError(err.response?.data?.error || 'Failed to update the slide order.');
    } finally {
      setReordering(false);
    }
  }

  const visibleImage = imagePreview || existingImage;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Image Carousels</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure the sliding banners on Home (Scheduled), Home (Instant) and Livestream.
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary btn-sm sm:btn shrink-0">
          <Plus size={15} />
          <span className="hidden sm:inline">Add Slide</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Location tabs — each carousel is configured independently */}
      <div className="flex flex-wrap gap-2">
        {LOCATIONS.map((l) => {
          const Icon = l.icon;
          const count = (groups[l.key] || []).length;
          const active = l.key === activeLoc;
          return (
            <button
              key={l.key}
              onClick={() => { setActiveLoc(l.key); setShowForm(false); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition ${
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon size={15} />
              {l.label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Aspect-ratio guidance for the active location */}
      <div className="card p-3 sm:p-4 flex items-start gap-3 bg-blue-50/50 border-blue-100">
        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
          <Images size={17} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Recommended aspect ratio {loc.ratio} · {loc.recommend}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{loc.hint}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Uploads are not validated — any size works, but off-ratio images may be cropped or letterboxed.
          </p>
        </div>
      </div>

      {showForm && (
        <div className="card p-4 sm:p-5 animate-scale-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Images size={15} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-800">
              {editingId ? 'Edit Slide' : 'New Slide'} · <span className="text-slate-500">{loc.label}</span>
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex flex-wrap items-center gap-1.5 mb-2">
                <Upload size={13} />
                Slide Image
                <span className="text-slate-400 font-normal normal-case tracking-normal">
                  Aspect ratio {loc.ratio} · recommended {loc.recommend} · JPG / PNG / WEBP
                </span>
              </label>
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <div
                  className="w-full sm:w-56 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0"
                  style={{ aspectRatio: loc.ratio.replace(' : ', ' / ') }}
                >
                  {visibleImage ? (
                    <img src={visibleImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Images size={26} className="text-slate-300" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary">
                    <Upload size={15} />
                    {visibleImage ? 'Change Image' : 'Upload Image'}
                  </button>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Title <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  placeholder="e.g. Fresh paneer offer"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Link URL <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  placeholder="https://…"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="input"
                />
              </div>
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
        <div className="grid gap-3 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-40 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : slides.length === 0 ? (
        <div className="card p-10 sm:p-16 text-center">
          <Images size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No slides for {loc.label} yet</p>
          <p className="text-slate-400 text-sm mt-1">Add your first slide above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {slides.map((slide, index) => (
            <div key={slide.id} className="card p-3">
              <div
                className="w-full rounded-lg overflow-hidden bg-slate-100 border border-slate-100 relative"
                style={{ aspectRatio: loc.ratio.replace(' : ', ' / ') }}
              >
                {slide.image_url ? (
                  <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Images size={22} className="text-slate-300" />
                  </div>
                )}
                {slide.is_active === false && (
                  <span className="absolute top-2 left-2 text-[10px] font-semibold bg-slate-800/80 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                    <EyeOff size={10} /> Hidden
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">Position #{index + 1}</p>
                  {slide.title ? (
                    <p className="text-sm font-medium text-slate-700 truncate">{slide.title}</p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Untitled slide</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => moveSlide(index, -1)}
                    disabled={reordering || index === 0}
                    className="btn-icon p-2 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    onClick={() => moveSlide(index, 1)}
                    disabled={reordering || index === slides.length - 1}
                    className="btn-icon p-2 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button onClick={() => openEdit(slide)} className="btn-icon" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(slide)}
                    className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
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
                <p className="font-semibold text-slate-800">Delete Slide?</p>
                <p className="text-sm text-slate-500 mt-1">
                  This slide will be permanently removed from the <span className="font-medium text-slate-700">{loc.label}</span> carousel.
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
