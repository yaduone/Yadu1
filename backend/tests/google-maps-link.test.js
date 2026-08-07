const { extractCoordinates, resolveMapsLink } = require('../src/utils/googleMaps');

describe('extractCoordinates', () => {
  it('prefers the place pin (!3d/!4d) over the viewport centre', () => {
    const url =
      'https://www.google.com/maps/place/Yadu+One/@28.6100000,77.2000000,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d28.6139391!4d77.2090212';
    expect(extractCoordinates(url)).toEqual({
      latitude: 28.6139391,
      longitude: 77.2090212,
    });
  });

  it('reads the viewport centre when there is no place pin', () => {
    expect(extractCoordinates('https://www.google.com/maps/@28.6139,77.2090,15z')).toEqual({
      latitude: 28.6139,
      longitude: 77.209,
    });
  });

  it('reads the q parameter, including the loc: prefix', () => {
    expect(extractCoordinates('https://maps.google.com/?q=28.6139,77.2090')).toEqual({
      latitude: 28.6139,
      longitude: 77.209,
    });
    expect(extractCoordinates('https://www.google.com/maps?q=loc:-33.8688,151.2093')).toEqual({
      latitude: -33.8688,
      longitude: 151.2093,
    });
  });

  it('reads the Maps URL API query parameter', () => {
    expect(
      extractCoordinates('https://www.google.com/maps/search/?api=1&query=28.6139%2C77.2090')
    ).toEqual({ latitude: 28.6139, longitude: 77.209 });
  });

  it('reads geo: URIs', () => {
    expect(extractCoordinates('geo:28.6139,77.2090')).toEqual({
      latitude: 28.6139,
      longitude: 77.209,
    });
  });

  it('reads a bare "lat, lng" pair', () => {
    expect(extractCoordinates('28.6139, 77.2090')).toEqual({
      latitude: 28.6139,
      longitude: 77.209,
    });
  });

  it('rejects out-of-range and null-island coordinates', () => {
    expect(extractCoordinates('https://www.google.com/maps/@91.0,77.2,15z')).toBeNull();
    expect(extractCoordinates('0, 0')).toBeNull();
  });

  it('returns null for links with no coordinates', () => {
    expect(extractCoordinates('https://maps.app.goo.gl/abc123')).toBeNull();
    expect(extractCoordinates('')).toBeNull();
    expect(extractCoordinates(null)).toBeNull();
  });
});

describe('resolveMapsLink', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('resolves a full link without any network call', async () => {
    global.fetch = jest.fn();
    const result = await resolveMapsLink('https://www.google.com/maps/@28.6139,77.2090,15z');
    expect(result).toMatchObject({ latitude: 28.6139, longitude: 77.209 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('expands a short link by following its redirect', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 302,
      ok: false,
      headers: {
        get: (name) =>
          name.toLowerCase() === 'location'
            ? 'https://www.google.com/maps/place/Yadu+One/@28.6139391,77.2090212,17z'
            : null,
      },
    });

    const result = await resolveMapsLink('https://maps.app.goo.gl/abc123');
    expect(result).toMatchObject({ latitude: 28.6139391, longitude: 77.2090212 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('refuses to fetch non-Google hosts', async () => {
    global.fetch = jest.fn();
    const result = await resolveMapsLink('http://169.254.169.254/latest/meta-data/');
    expect(result.error).toMatch(/Only Google Maps links/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports a helpful error when the link carries no coordinates', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: () => null },
      text: async () => '<html>consent page</html>',
    });

    const result = await resolveMapsLink('https://maps.app.goo.gl/abc123');
    expect(result.error).toMatch(/No coordinates found/);
  });

  it('rejects empty input', async () => {
    expect((await resolveMapsLink('')).error).toBeTruthy();
    expect((await resolveMapsLink(undefined)).error).toBeTruthy();
  });
});
