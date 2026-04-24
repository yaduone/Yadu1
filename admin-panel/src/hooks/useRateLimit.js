import { useState, useCallback, useRef } from 'react';

/**
 * Hook that wraps an async action with:
 * - Debounce (prevents double-clicks)
 * - 429 handling with countdown timer
 *
 * Usage:
 *   const { execute, loading, rateLimited, retryIn } = useRateLimit(myApiCall);
 *   <button onClick={execute} disabled={loading || rateLimited}>
 *     {rateLimited ? `Retry in ${retryIn}s` : 'Submit'}
 *   </button>
 */
export function useRateLimit(action, debounceMs = 500) {
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryIn, setRetryIn] = useState(0);
  const timerRef = useRef(null);
  const lastCallRef = useRef(0);

  const startCountdown = useCallback((seconds) => {
    setRateLimited(true);
    setRetryIn(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRetryIn((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setRateLimited(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const execute = useCallback(async (...args) => {
    // Debounce
    const now = Date.now();
    if (now - lastCallRef.current < debounceMs) return;
    lastCallRef.current = now;

    if (loading || rateLimited) return;

    setLoading(true);
    try {
      return await action(...args);
    } catch (err) {
      if (err.isRateLimited) {
        startCountdown(err.retryAfter || 60);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [action, loading, rateLimited, debounceMs, startCountdown]);

  return { execute, loading, rateLimited, retryIn };
}
