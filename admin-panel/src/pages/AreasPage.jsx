import { useState, useEffect } from 'react';
import api from '../services/api';
import { MapPin, Info } from 'lucide-react';

export default function AreasPage() {
  const [areas, setAreas]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/areas')
      .then((res) => setAreas(res.data.data.areas))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Areas</h2>
          <p className="text-xs text-slate-400 mt-0.5">Active service areas in your region</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
        <Info size={15} className="shrink-0 mt-0.5" />
        <span>Area management is restricted to super admins. Contact your administrator to make changes.</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-14 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : areas.length === 0 ? (
        <div className="card p-12 text-center">
          <MapPin size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No areas found.</p>
        </div>
      ) : (
        <div className="card overflow-hidden max-w-2xl">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                        <MapPin size={14} className="text-blue-600" />
                      </div>
                      <span className="font-semibold text-slate-800">{a.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-gray font-mono">{a.slug}</span>
                  </td>
                  <td className="font-mono text-xs text-slate-400">{a.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
