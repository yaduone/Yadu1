import { useState, useEffect } from 'react';
import api from '../services/api';
import { Pencil, Check, X, IndianRupee, Info } from 'lucide-react';

export default function PricesPage() {
  const [prices, setPrices]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editingType, setEditingType] = useState(null);
  const [editPrice, setEditPrice]   = useState('');
  const [saving, setSaving]         = useState(false);

  function loadPrices() {
    setLoading(true);
    api.get('/prices')
      .then((res) => setPrices(res.data.data.prices))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPrices(); }, []);

  async function handleUpdate(milkType) {
    setSaving(true);
    try {
      await api.put(`/prices/${milkType}`, { price_per_litre: parseFloat(editPrice) });
      setEditingType(null);
      loadPrices();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update price');
    } finally {
      setSaving(false);
    }
  }

  const MILK_ICONS = { cow: '🐄', buffalo: '🐃', toned: '🥛' };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Milk Prices</h2>
        <p className="text-xs text-slate-400 mt-0.5">Manage per-litre pricing for each milk type</p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        <Info size={15} className="shrink-0 mt-0.5" />
        <span>Price changes only affect <strong>new subscriptions</strong>. Existing subscriptions retain their locked-in price.</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-16 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden max-w-lg">
          <table className="data-table">
            <thead>
              <tr>
                <th>Milk Type</th>
                <th>Price / Litre</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.milk_type}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{MILK_ICONS[p.milk_type] || '🥛'}</span>
                      <span className="font-semibold text-slate-800 capitalize">{p.milk_type}</span>
                    </div>
                  </td>
                  <td>
                    {editingType === p.milk_type ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-sm">₹</span>
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="input w-24 py-1.5 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate(p.milk_type);
                            if (e.key === 'Escape') setEditingType(null);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <IndianRupee size={14} className="text-slate-400" />
                        <span className="font-semibold text-slate-800">{p.price_per_litre}</span>
                        <span className="text-slate-400 text-xs">/ L</span>
                      </div>
                    )}
                  </td>
                  <td>
                    {editingType === p.milk_type ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleUpdate(p.milk_type)}
                          disabled={saving}
                          className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-400 disabled:opacity-60"
                        >
                          <Check size={13} />
                          Save
                        </button>
                        <button
                          onClick={() => setEditingType(null)}
                          className="btn-secondary btn-sm"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingType(p.milk_type); setEditPrice(String(p.price_per_litre)); }}
                        className="btn-ghost btn-sm"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                    )}
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
