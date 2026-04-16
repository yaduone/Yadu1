import { useState, useEffect } from 'react';
import api from '../services/api';

export default function PricesPage() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState(null);
  const [editPrice, setEditPrice] = useState('');

  function loadPrices() {
    setLoading(true);
    api.get('/prices')
      .then((res) => setPrices(res.data.data.prices))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPrices(); }, []);

  async function handleUpdate(milkType) {
    try {
      await api.put(`/prices/${milkType}`, { price_per_litre: parseFloat(editPrice) });
      setEditingType(null);
      loadPrices();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Milk Prices</h2>
      <p className="text-sm text-gray-500 mb-4">
        Price changes only affect new subscriptions. Existing subscriptions retain their locked-in price.
      </p>

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <div className="bg-white rounded-xl border overflow-hidden max-w-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Milk Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Price / Litre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prices.map((p) => (
                <tr key={p.milk_type} className="hover:bg-gray-50">
                  <td className="px-4 py-3 capitalize font-medium">{p.milk_type}</td>
                  <td className="px-4 py-3">
                    {editingType === p.milk_type ? (
                      <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="border rounded px-2 py-1 text-sm w-24" />
                    ) : (
                      `₹${p.price_per_litre}`
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingType === p.milk_type ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleUpdate(p.milk_type)} className="text-xs bg-green-600 text-white px-2 py-1 rounded">Save</button>
                        <button onClick={() => setEditingType(null)} className="text-xs bg-gray-300 px-2 py-1 rounded">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingType(p.milk_type); setEditPrice(String(p.price_per_litre)); }} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
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
