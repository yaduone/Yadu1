/**
 * Google Maps link parsing.
 *
 * Admins often have a customer's location as a shared Google Maps link rather
 * than being physically at the address. These helpers turn such a link into
 * plain { latitude, longitude } coordinates.
 *
 * Short links (maps.app.goo.gl, goo.gl/maps) carry no coordinates at all, so
 * they must be expanded by following the redirect before parsing.
 */

const SHORT_LINK_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'g.co',
  'maps.google.com', // maps.google.com/maps?cid=... also redirects
]);

// Only these hosts are ever fetched server-side, to keep this from becoming an
// open proxy / SSRF vector.
const FETCHABLE_HOST_PATTERN = /^([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl|g\.co)$/i;

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 8000;

function isValidLatLon(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    // 0,0 is in the Atlantic — always a parsing artefact for this product.
    !(lat === 0 && lon === 0)
  );
}

function pairFrom(latStr, lonStr) {
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  return isValidLatLon(lat, lon) ? { latitude: lat, longitude: lon } : null;
}

/**
 * Extract coordinates from an already-expanded Google Maps URL (or a raw
 * "lat, lng" string an admin pasted).
 *
 * Returns { latitude, longitude } or null.
 */
function extractCoordinates(input) {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (!text) return null;

  const decoded = (() => {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  })();

  // 1. `!3d<lat>!4d<lng>` — the exact place pin. Most accurate, so try first.
  const placePin = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (placePin) {
    const coords = pairFrom(placePin[1], placePin[2]);
    if (coords) return coords;
  }

  // 2. Query parameters that name a point: q, query, ll, sll, daddr, destination,
  //    center. Values may be prefixed with `loc:`.
  const paramMatch = decoded.match(
    /[?&](?:q|query|ll|sll|daddr|destination|center)=(?:loc:)?(-?\d+(?:\.\d+)?)[,+\s]+(-?\d+(?:\.\d+)?)/i
  );
  if (paramMatch) {
    const coords = pairFrom(paramMatch[1], paramMatch[2]);
    if (coords) return coords;
  }

  // 3. `geo:` URIs (shared from Android).
  const geoMatch = decoded.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (geoMatch) {
    const coords = pairFrom(geoMatch[1], geoMatch[2]);
    if (coords) return coords;
  }

  // 4. `/@<lat>,<lng>,<zoom>z` — the map viewport centre. Less precise than the
  //    place pin but present on nearly every desktop share link.
  const viewport = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (viewport) {
    const coords = pairFrom(viewport[1], viewport[2]);
    if (coords) return coords;
  }

  // 5. A bare "lat, lng" pair pasted without any URL around it.
  const bare = decoded.match(/^\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?$/);
  if (bare) {
    const coords = pairFrom(bare[1], bare[2]);
    if (coords) return coords;
  }

  return null;
}

function parseUrl(raw) {
  const text = String(raw).trim();
  try {
    return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
}

function isFetchableHost(url) {
  return !!url && FETCHABLE_HOST_PATTERN.test(url.hostname);
}

/**
 * Follow redirects on a Google short link until a URL containing coordinates
 * appears. Returns the final URL string, or null if it could not be expanded.
 */
async function expandShortLink(url) {
  let current = url;

  for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
    if (!isFetchableHost(current)) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          // Google serves a coordinate-bearing redirect to real browsers only.
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }

    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      const next = parseUrl(new URL(location, current).toString());
      if (!next) return null;
      current = next;
      if (extractCoordinates(current.toString())) return current.toString();
      continue;
    }

    if (res.ok) {
      // Terminal page: consent interstitials and the app-landing page embed the
      // real coordinates somewhere in the HTML body.
      let body = '';
      try {
        body = await res.text();
      } catch {
        return null;
      }
      const embedded = body.match(/https?:\/\/[^"'\s\\]*(?:!3d-?\d|@-?\d+\.\d+,-?\d)[^"'\s\\]*/);
      if (embedded && extractCoordinates(embedded[0])) return embedded[0];
      if (extractCoordinates(body)) return body;
      return current.toString();
    }

    return null;
  }

  return null;
}

/**
 * Resolve any pasted Google Maps link (short or full) to coordinates.
 *
 * Returns { latitude, longitude, resolved_url } on success, or
 * { error: '<reason>' } on failure.
 */
async function resolveMapsLink(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { error: 'Paste a Google Maps link or "latitude, longitude" pair' };
  }

  const text = raw.trim();

  // Direct hit — full links and bare coordinate pairs need no network call.
  const direct = extractCoordinates(text);
  if (direct) return { ...direct, resolved_url: text };

  const url = parseUrl(text);
  if (!url) {
    return { error: 'That does not look like a valid Google Maps link' };
  }

  if (!isFetchableHost(url)) {
    return {
      error: 'Only Google Maps links are supported. Paste a link from google.com/maps or maps.app.goo.gl',
    };
  }

  // Either a short link, or a google.com link with no coordinates in it (e.g. a
  // search by place name) — both are worth expanding.
  const expanded = await expandShortLink(url);
  if (!expanded) {
    return {
      error:
        'Could not open that link. Check your connection, or open the link in Maps and paste the full URL (the one containing "@lat,lng").',
    };
  }

  const coords = extractCoordinates(expanded);
  if (!coords) {
    return {
      error:
        'No coordinates found in that link. In Google Maps, drop a pin or long-press the exact spot, then use Share > Copy link.',
    };
  }

  return { ...coords, resolved_url: expanded };
}

module.exports = {
  extractCoordinates,
  resolveMapsLink,
  expandShortLink,
  isValidLatLon,
};
