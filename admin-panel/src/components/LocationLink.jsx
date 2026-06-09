import { MapPin } from 'lucide-react';

export default function LocationLink({ location, className = '', size = 14 }) {
  if (!location?.latitude || !location?.longitude) {
    return null;
  }

  const mapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 ${className}`}
      title={`Open location in Google Maps (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`}
      onClick={(e) => e.stopPropagation()}
    >
      <MapPin size={size} />
      <span>Location</span>
    </a>
  );
}
