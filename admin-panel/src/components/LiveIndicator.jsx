import { useState, useEffect } from 'react';

/**
 * Signals that a page keeps itself current, and how recently that last
 * succeeded — without it, an operator cannot tell a genuinely quiet period from
 * a silently broken connection.
 *
 * Pair with the useLiveRefresh hook, passing through its lastUpdated/refreshNow.
 */
export default function LiveIndicator({ lastUpdated, onRefresh, staleAfterSeconds = 60 }) {
  const [seconds, setSeconds] = useState(null);

  // Read the clock only inside the interval callback — calling Date.now()
  // during render is an impure read, and the elapsed label is derived state.
  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(lastUpdated ? Math.round((Date.now() - lastUpdated.getTime()) / 1000) : null);
    }, 1_000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  // Well past the poll interval means refreshes are failing, not merely idle.
  const stale = seconds !== null && seconds > staleAfterSeconds;

  // Before the first background sync there is nothing to report an age for —
  // the page has just loaded its data directly. Saying "Connecting..." over
  // freshly rendered rows would read as a fault where there is none.
  let label = null;
  if (seconds !== null) {
    if (seconds < 10) label = 'Updated just now';
    else if (seconds < 60) label = `Updated ${seconds}s ago`;
    else label = `Updated ${Math.round(seconds / 60)}m ago`;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${
        stale ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'
      }`} />
      <span>
        {stale && `${label} - check your connection`}
        {!stale && (label ? `Live - ${label}` : 'Live')}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        className="text-slate-400 hover:text-violet-600 underline underline-offset-2"
      >
        Refresh
      </button>
    </div>
  );
}
