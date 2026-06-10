import { MapPin } from 'lucide-react';

export default function LocationLink({ location, className = '', size = 14, showLabel = true }) {
  if (!location?.latitude || !location?.longitude) {
    return null;
  }

  // Validate coordinates
  const lat = parseFloat(location.latitude);
  const lon = parseFloat(location.longitude);
  
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    console.warn('Invalid coordinates:', location);
    return null;
  }

  const openMaps = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
    
    // Try to open in new window/tab
    const newWindow = window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    
    // Fallback if popup was blocked
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      window.location.href = mapsUrl;
    }
  };

  const coordsText = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;

  return (
    <button
      onClick={openMaps}
      className={`inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline transition-colors ${className}`}
      title={`Open in Google Maps: ${coordsText}`}
      type="button"
    >
      <MapPin size={size} className="flex-shrink-0" />
      {showLabel && <span>Location</span>}
    </button>
  );
}
