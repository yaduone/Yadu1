import { useState, useEffect } from 'react';
import api from '../services/api';

export default function AreasPage() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/areas')
      .then((res) => setAreas(res.data.data.areas))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Areas</h2>
      <p className="text-sm text-gray-500 mb-4">Area management is restricted to super admins. Below are the active service areas.</p>

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {areas.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{a.name}</td>
                  <td className="px-4 py-3 text-gray-600">{a.slug}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{a.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
