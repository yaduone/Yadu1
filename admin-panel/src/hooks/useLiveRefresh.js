import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Keeps a page's data fresh without the operator hitting reload.
 *
 * Three triggers, all funnelling through one guarded runner:
 *   - a background interval while the tab is visible
 *   - the tab regaining visibility (catches everything missed while hidden)
 *   - an explicit refreshNow(), e.g. when an FCM push announces a new order
 *
 * Polling stops while the tab is hidden — an admin panel is routinely left open
 * in a background tab all day, and polling one is pure load for updates nobody
 * can see.
 *
 * The caller's refresh function must be *silent*: it should not toggle loading
 * skeletons or reset selection, or the list will flash and lose the operator's
 * checkboxes on every tick.
 *
 * Usage:
 *   const { lastUpdated, refreshNow } = useLiveRefresh(
 *     () => loadOrders({ silent: true }),
 *     { intervalMs: 15_000 },
 *   );
 */
export function useLiveRefresh(refresh, { intervalMs = 20_000, enabled = true } = {}) {
  const [lastUpdated, setLastUpdated] = useState(null);
  const refreshRef = useRef(refresh);
  const inFlight = useRef(false);

  // Keep the latest closure without restarting the interval on every render.
  refreshRef.current = refresh;

  const refreshNow = useCallback(async () => {
    // Skip if a refresh is still running, so a slow response can't pile up
    // overlapping requests behind it.
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await refreshRef.current();
      setLastUpdated(new Date());
    } catch {
      // Leave lastUpdated alone: the displayed timestamp should reflect the last
      // genuinely successful sync, not a failed attempt.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const tick = () => {
      if (document.visibilityState === 'visible') refreshNow();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshNow();
    };

    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, intervalMs, refreshNow]);

  return { lastUpdated, refreshNow };
}
