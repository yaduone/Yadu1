import { useState, useEffect, useCallback } from 'react';
import { X, MapPin, Loader2, Navigation, Trash2, ExternalLink, AlertCircle, Link2 } from 'lucide-react';
import api from '../services/api';

const MODE_GPS = 'gps';
const MODE_LINK = 'maps_link';

/**
 * Parse coordinates out of a full Google Maps URL locally, so the common case
 * needs no round-trip. Short links (maps.app.goo.gl) have no coordinates in
 * them and are resolved by the backend instead.
 */
function parseMapsLink(raw) {
  if (!raw) return null;

  let text = raw.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    // Keep the raw text if it is not valid percent-encoding.
  }

  const toCoords = (latStr, lonStr) => {
    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);
    const valid =
      Number.isFinite(latitude) && Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180 &&
      !(latitude === 0 && longitude === 0);
    return valid ? { latitude, longitude } : null;
  };

  const patterns = [
    // !3d<lat>!4d<lng> — the exact place pin, most accurate.
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    // ?q= / &query= / &ll= etc, optionally prefixed with `loc:`
    /[?&](?:q|query|ll|sll|daddr|destination|center)=(?:loc:)?(-?\d+(?:\.\d+)?)[,+\s]+(-?\d+(?:\.\d+)?)/i,
    // geo: URI shared from Android
    /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    // /@<lat>,<lng>,<zoom>z — the viewport centre
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    // A bare "lat, lng" pair with no URL around it
    /^\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const coords = toCoords(match[1], match[2]);
      if (coords) return coords;
    }
  }

  return null;
}

export default function LocationModal({ user, onClose, onLocationUpdated }) {
  const [state, setState] = useState({
    loading: false,
    error: '',
    success: '',
    fetchingLocation: false,
    resolvingLink: false,
    loadingExisting: true,
  });
  const [mode, setMode] = useState(MODE_GPS);
  const [linkInput, setLinkInput] = useState('');
  const [pendingSource, setPendingSource] = useState(MODE_GPS);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [existingLocation, setExistingLocation] = useState(null);

  // Load existing location
  useEffect(() => {
    let cancelled = false;

    const loadLocation = async () => {
      try {
        const res = await api.get(`/users/admin/${user.id}/location`);
        if (!cancelled && res.data.data.location) {
          setExistingLocation(res.data.data.location);
        }
      } catch {
        // Silently fail - user might not have location yet
        if (!cancelled) {
          console.log('No existing location found');
        }
      } finally {
        if (!cancelled) {
          setState(prev => ({ ...prev, loadingExisting: false }));
        }
      }
    };

    loadLocation();
    return () => { cancelled = true; };
  }, [user.id]);

  const clearMessages = useCallback(() => {
    setState(prev => ({ ...prev, error: '', success: '' }));
  }, []);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({ 
        ...prev, 
        error: 'Geolocation is not supported by your browser. Please use a modern browser or enable location services.' 
      }));
      return;
    }

    setState(prev => ({ ...prev, fetchingLocation: true, error: '', success: '' }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCurrentLocation(newLocation);
        setPendingSource(MODE_GPS);
        setState(prev => ({
          ...prev,
          fetchingLocation: false,
          success: 'Location captured! Review coordinates and click "Save Location" to record.'
        }));
      },
      (error) => {
        let errorMessage = 'Failed to get location. ';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Location access denied. Please enable location permissions in your browser settings and try again.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable. Make sure GPS is enabled on your device.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage += 'An unknown error occurred. Please try again.';
        }
        
        setState(prev => ({ ...prev, fetchingLocation: false, error: errorMessage }));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout
        maximumAge: 0,
      }
    );
  }, []);

  const resolveLink = useCallback(async () => {
    const raw = linkInput.trim();
    if (!raw) {
      setState(prev => ({ ...prev, error: 'Paste a Google Maps link first' }));
      return;
    }

    setState(prev => ({ ...prev, error: '', success: '' }));

    // Full links carry their coordinates — no need to ask the server.
    const local = parseMapsLink(raw);
    if (local) {
      setCurrentLocation(local);
      setPendingSource(MODE_LINK);
      setState(prev => ({
        ...prev,
        success: 'Coordinates read from link. Preview the pin, then click "Save Location".',
      }));
      return;
    }

    // Short links (maps.app.goo.gl) must be expanded server-side.
    setState(prev => ({ ...prev, resolvingLink: true }));
    try {
      const res = await api.post('/users/admin/location/resolve-link', { url: raw });
      const { latitude, longitude } = res.data.data;
      setCurrentLocation({ latitude, longitude });
      setPendingSource(MODE_LINK);
      setState(prev => ({
        ...prev,
        resolvingLink: false,
        success: 'Link resolved. Preview the pin, then click "Save Location".',
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        resolvingLink: false,
        error: err.response?.data?.error || 'Could not read a location from that link.',
      }));
    }
  }, [linkInput]);

  const saveLocation = useCallback(async () => {
    if (!currentLocation) {
      setState(prev => ({ ...prev, error: 'Please capture location first' }));
      return;
    }

    // Validate coordinates
    const { latitude, longitude } = currentLocation;
    if (isNaN(latitude) || isNaN(longitude) || 
        latitude < -90 || latitude > 90 || 
        longitude < -180 || longitude > 180) {
      setState(prev => ({ ...prev, error: 'Invalid coordinates captured. Please try again.' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: '', success: '' }));

    try {
      await api.post(`/users/admin/${user.id}/location`, {
        ...currentLocation,
        source: pendingSource,
      });

      const newExistingLocation = {
        ...currentLocation,
        source: pendingSource,
        recorded_at: new Date().toISOString(),
      };

      setExistingLocation(newExistingLocation);
      setCurrentLocation(null);
      setLinkInput('');
      setState(prev => ({
        ...prev,
        loading: false,
        success: 'Location saved successfully!'
      }));
      
      // Notify parent to refresh data
      if (onLocationUpdated) {
        setTimeout(() => onLocationUpdated(), 500);
      }
    } catch (err) {
      setState(prev => ({ 
        ...prev,
        loading: false,
        error: err.response?.data?.error || 'Failed to save location. Please try again.'
      }));
    }
  }, [currentLocation, pendingSource, user.id, onLocationUpdated]);

  const deleteLocation = useCallback(async () => {
    if (!window.confirm('Are you sure you want to remove this location? This action cannot be undone.')) {
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: '', success: '' }));

    try {
      await api.delete(`/users/admin/${user.id}/location`);
      
      setExistingLocation(null);
      setCurrentLocation(null);
      setLinkInput('');
      setState(prev => ({
        ...prev,
        loading: false,
        success: 'Location removed successfully!'
      }));
      
      // Notify parent to refresh data
      if (onLocationUpdated) {
        setTimeout(() => onLocationUpdated(), 500);
      }
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        loading: false,
        error: err.response?.data?.error || 'Failed to remove location. Please try again.' 
      }));
    }
  }, [user.id, onLocationUpdated]);

  const openInMaps = useCallback((lat, lon) => {
    const url = `https://www.google.com/maps?q=${lat},${lon}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const hasExistingLocation = existingLocation && !currentLocation;
  const hasPendingLocation = !!currentLocation;
  const busy = state.loading || state.fetchingLocation || state.resolvingLink;

  const switchMode = useCallback((nextMode) => {
    setMode(nextMode);
    setCurrentLocation(null);
    clearMessages();
  }, [clearMessages]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onClose();
        }
      }}
    >
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
          <button
            onClick={onClose}
            disabled={busy}
            className="btn-icon text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => switchMode(MODE_GPS)}
              disabled={busy}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                mode === MODE_GPS
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Navigation size={13} />
              Use GPS
            </button>
            <button
              type="button"
              onClick={() => switchMode(MODE_LINK)}
              disabled={busy}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                mode === MODE_LINK
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Link2 size={13} />
              Paste Maps Link
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            {mode === MODE_GPS ? (
              <p className="text-xs text-blue-700">
                <strong>Instructions:</strong> Click "Use Current Location" to capture GPS coordinates.
                You must be physically at the user's location for accurate recording.
              </p>
            ) : (
              <p className="text-xs text-blue-700">
                <strong>Instructions:</strong> Ask the user to share their location from Google Maps
                (<em>Share &rsaquo; Copy link</em>) and paste it below. Short links like
                {' '}<code className="font-mono">maps.app.goo.gl/…</code> work too, as do plain
                {' '}<code className="font-mono">latitude, longitude</code> pairs.
              </p>
            )}
          </div>

          {/* Google Maps link input */}
          {mode === MODE_LINK && !hasPendingLocation && (
            <div className="space-y-2">
              <label htmlFor="maps-link" className="block text-xs font-medium text-slate-600">
                Google Maps link
              </label>
              <textarea
                id="maps-link"
                rows={3}
                value={linkInput}
                onChange={(e) => {
                  setLinkInput(e.target.value);
                  if (state.error || state.success) clearMessages();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    resolveLink();
                  }
                }}
                disabled={busy}
                placeholder="https://maps.app.goo.gl/…"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 disabled:opacity-60"
              />
            </div>
          )}

          {/* Loading State */}
          {state.loadingExisting ? (
            <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading location data...</span>
            </div>
          ) : (
            <>
              {/* Existing Location Display */}
              {hasExistingLocation && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 mb-1">Saved Location</p>
                      <div className="space-y-1 text-xs text-emerald-700">
                        <p><strong>Lat:</strong> {existingLocation.latitude.toFixed(6)}</p>
                        <p><strong>Lng:</strong> {existingLocation.longitude.toFixed(6)}</p>
                        {existingLocation.source && (
                          <p>
                            <strong>Source:</strong>{' '}
                            {existingLocation.source === MODE_LINK ? 'Google Maps link' : 'Device GPS'}
                          </p>
                        )}
                        {existingLocation.recorded_at && (
                          <p className="text-emerald-600 mt-2">
                            {new Date(existingLocation.recorded_at).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={deleteLocation}
                      disabled={state.loading}
                      className="btn-icon text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                      title="Remove location"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <button
                    onClick={() => openInMaps(existingLocation.latitude, existingLocation.longitude)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ExternalLink size={12} />
                    Open in Google Maps
                  </button>
                </div>
              )}

              {/* Pending Location Display */}
              {hasPendingLocation && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800 mb-1">New Location (Unsaved)</p>
                      <div className="space-y-1 text-xs text-amber-700">
                        <p><strong>Lat:</strong> {currentLocation.latitude.toFixed(6)}</p>
                        <p><strong>Lng:</strong> {currentLocation.longitude.toFixed(6)}</p>
                        <p className="text-amber-600">
                          From {pendingSource === MODE_LINK ? 'pasted Google Maps link' : 'device GPS'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => openInMaps(currentLocation.latitude, currentLocation.longitude)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ExternalLink size={12} />
                    Preview in Google Maps
                  </button>
                </div>
              )}
            </>
          )}

          {/* Error Message */}
          {state.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Success Message */}
          {state.success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-sm text-emerald-700">
              {state.success}
            </div>
          )}

          {/* Warning for Pending Location */}
          {hasPendingLocation && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-700">
                <strong>⚠️ Important:</strong> This location will be permanently saved and visible to all admins.
                {pendingSource === MODE_LINK
                  ? ' Open the preview in Google Maps and confirm the pin is on the right building before saving.'
                  : ' Verify the coordinates are correct before saving.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={busy}
          >
            {busy ? 'Please wait...' : 'Close'}
          </button>

          {!hasPendingLocation && !state.loadingExisting && mode === MODE_GPS && (
            <button
              onClick={getCurrentLocation}
              disabled={busy}
              className="btn-primary disabled:opacity-60"
            >
              {state.fetchingLocation ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Getting Location...
                </>
              ) : (
                <>
                  <Navigation size={14} />
                  {hasExistingLocation ? 'Update Location' : 'Use Current Location'}
                </>
              )}
            </button>
          )}

          {!hasPendingLocation && !state.loadingExisting && mode === MODE_LINK && (
            <button
              onClick={resolveLink}
              disabled={busy || !linkInput.trim()}
              className="btn-primary disabled:opacity-60"
            >
              {state.resolvingLink ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Reading Link...
                </>
              ) : (
                <>
                  <Link2 size={14} />
                  Read Location
                </>
              )}
            </button>
          )}

          {hasPendingLocation && (
            <>
              <button
                onClick={() => {
                  setCurrentLocation(null);
                  clearMessages();
                }}
                disabled={state.loading}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveLocation}
                disabled={state.loading}
                className="btn bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {state.loading ? (
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
