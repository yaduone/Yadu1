import { useState, useEffect } from 'react';
import { X, MapPin, Loader2, Navigation, Trash2, ExternalLink } from 'lucide-react';
import api from '../services/api';

export default function LocationModal({ user, onClose, onLocationUpdated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [existingLocation, setExistingLocation] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    // Load existing location if any
    setLoadingExisting(true);
    api.get(`/users/admin/${user.id}/location`)
      .then((res) => {
        if (res.data.data.location) {
          setExistingLocation(res.data.data.location);
        }
      })
      .catch(() => {
        // Silently fail - user might not have location yet
      })
      .finally(() => setLoadingExisting(false));
  }, [user.id]);

  async function getCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setFetchingLocation(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setFetchingLocation(false);
        setSuccess('Location captured successfully! Click "Save Location" to record it.');
      },
      (error) => {
        setFetchingLocation(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setError('Location access denied. Please enable location permissions in your browser.');
            break;
          case error.POSITION_UNAVAILABLE:
            setError('Location information is unavailable.');
            break;
          case error.TIMEOUT:
            setError('Location request timed out.');
            break;
          default:
            setError('An unknown error occurred while getting location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  async function saveLocation() {
    if (!currentLocation) {
      setError('Please get current location first');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.post(`/users/admin/${user.id}/location`, currentLocation);
      setSuccess('Location saved successfully!');
      setExistingLocation({
        ...currentLocation,
        recorded_at: new Date().toISOString(),
      });
      setCurrentLocation(null);
      if (onLocationUpdated) onLocationUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  }

  async function deleteLocation() {
    if (!confirm('Are you sure you want to remove this location?')) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.delete(`/users/admin/${user.id}/location`);
      setSuccess('Location removed successfully!');
      setExistingLocation(null);
      setCurrentLocation(null);
      if (onLocationUpdated) onLocationUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove location');
    } finally {
      setLoading(false);
    }
  }

  function getGoogleMapsUrl(lat, lon) {
    return `https://www.google.com/maps?q=${lat},${lon}`;
  }

  const displayLocation = currentLocation || existingLocation;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <MapPin size={16} />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm leading-tight">Record Location</p>
              <p className="text-[10px] text-slate-400">{user.name || user.phone || 'Unknown user'}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs text-blue-700">
              <strong>Instructions:</strong> Click "Use Current Location" to capture your current position. 
              You must be physically at the user's location for accurate recording.
            </p>
          </div>

          {/* Existing Location Display */}
          {loadingExisting ? (
            <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading location data...</span>
            </div>
          ) : existingLocation && !currentLocation ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-emerald-800">Recorded Location</p>
                <button
                  onClick={deleteLocation}
                  disabled={loading}
                  className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50"
                  title="Remove location"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="space-y-1 text-xs text-emerald-700">
                <p><strong>Latitude:</strong> {existingLocation.latitude.toFixed(6)}</p>
                <p><strong>Longitude:</strong> {existingLocation.longitude.toFixed(6)}</p>
                {existingLocation.recorded_at && (
                  <p className="text-emerald-600 mt-2">
                    Recorded: {new Date(existingLocation.recorded_at).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
              <a
                href={getGoogleMapsUrl(existingLocation.latitude, existingLocation.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 mt-3"
              >
                <ExternalLink size={12} />
                Open in Google Maps
              </a>
            </div>
          ) : null}

          {/* Current Location Display */}
          {currentLocation && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">Captured Location (Not Saved)</p>
              <div className="space-y-1 text-xs text-amber-700">
                <p><strong>Latitude:</strong> {currentLocation.latitude.toFixed(6)}</p>
                <p><strong>Longitude:</strong> {currentLocation.longitude.toFixed(6)}</p>
              </div>
              <a
                href={getGoogleMapsUrl(currentLocation.latitude, currentLocation.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 mt-3"
              >
                <ExternalLink size={12} />
                Preview in Google Maps
              </a>
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 text-sm text-emerald-600">
              {success}
            </div>
          )}

          {/* Location Accuracy Info */}
          {currentLocation && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <p className="text-xs text-slate-600">
                <strong>Note:</strong> The recorded location will be permanently associated with this user 
                and visible to all admins. Make sure you are at the correct physical location.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary" disabled={loading || fetchingLocation}>
            Close
          </button>
          
          {!currentLocation && (
            <button
              onClick={getCurrentLocation}
              disabled={fetchingLocation || loading}
              className="btn-primary"
            >
              {fetchingLocation ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Getting Location...
                </>
              ) : (
                <>
                  <Navigation size={14} />
                  Use Current Location
                </>
              )}
            </button>
          )}

          {currentLocation && (
            <button
              onClick={saveLocation}
              disabled={loading}
              className="btn bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <MapPin size={14} />
                  Save Location
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
