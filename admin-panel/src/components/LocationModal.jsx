import { useState, useEffect, useCallback } from 'react';
import { X, MapPin, Loader2, Navigation, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function LocationModal({ user, onClose, onLocationUpdated }) {
  const [state, setState] = useState({
    loading: false,
    error: '',
    success: '',
    fetchingLocation: false,
    loadingExisting: true,
  });
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
      } catch (err) {
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
      await api.post(`/users/admin/${user.id}/location`, currentLocation);
      
      const newExistingLocation = {
        ...currentLocation,
        recorded_at: new Date().toISOString(),
      };
      
      setExistingLocation(newExistingLocation);
      setCurrentLocation(null);
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
  }, [currentLocation, user.id, onLocationUpdated]);

  const deleteLocation = useCallback(async () => {
    if (!window.confirm('Are you sure you want to remove this location? This action cannot be undone.')) {
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: '', success: '' }));

    try {
      await api.delete(`/users/admin/${user.id}/location`);
      
      setExistingLocation(null);
      setCurrentLocation(null);
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

  const displayLocation = currentLocation || existingLocation;
  const hasExistingLocation = existingLocation && !currentLocation;
  const hasPendingLocation = !!currentLocation;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !state.loading && !state.fetchingLocation) {
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
            disabled={state.loading || state.fetchingLocation}
            className="btn-icon text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs text-blue-700">
              <strong>Instructions:</strong> Click "Use Current Location" to capture GPS coordinates. 
              You must be physically at the user's location for accurate recording.
            </p>
          </div>

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
                Verify the coordinates are correct before saving.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-100 flex gap-2 justify-end">
          <button 
            onClick={onClose} 
            className="btn-secondary" 
            disabled={state.loading || state.fetchingLocation}
          >
            {state.loading || state.fetchingLocation ? 'Please wait...' : 'Close'}
          </button>
          
          {!hasPendingLocation && !state.loadingExisting && (
            <button
              onClick={getCurrentLocation}
              disabled={state.fetchingLocation || state.loading}
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
