import { useEffect, useRef, useCallback } from 'react';

interface SmartPollOptions {
  /** Base interval in ms (default 60_000) */
  intervalMs?: number;
  /** Max backoff multiplier (default 4) */
  maxBackoff?: number;
  /** Pause polling when tab is hidden (default true) */
  pauseWhenHidden?: boolean;
  /** Refresh immediately when tab becomes visible (default true) */
  refreshOnVisible?: boolean;
  /** Whether polling is enabled (default true) */
  enabled?: boolean;
}

/**
 * Smart polling hook inspired by worldmonitor's startSmartPollLoop.
 * Features:
 * - Exponential backoff on errors
 * - Tab visibility pause/resume
 * - Staggered refresh on visibility change
 * - Automatic cleanup
 */
export function useSmartPoll(
  fetchFn: () => Promise<void>,
  options: SmartPollOptions = {},
) {
  const {
    intervalMs = 60_000,
    maxBackoff = 4,
    pauseWhenHidden = true,
    refreshOnVisible = true,
    enabled = true,
  } = options;

  const backoffRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = intervalMs * backoffRef.current;
    timerRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      try {
        await fetchFn();
        backoffRef.current = 1; // reset on success
      } catch {
        backoffRef.current = Math.min(backoffRef.current * 2, maxBackoff);
      }
      if (isMountedRef.current) schedule();
    }, delay);
  }, [fetchFn, intervalMs, maxBackoff]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!enabled) return;

    schedule();

    // Tab visibility handling
    const handleVisibility = () => {
      if (document.hidden && pauseWhenHidden) {
        if (timerRef.current) clearTimeout(timerRef.current);
      } else if (!document.hidden) {
        if (refreshOnVisible) {
          // Stagger: small random delay to avoid thundering herd
          const stagger = Math.random() * 500;
          setTimeout(() => {
            if (isMountedRef.current) {
              fetchFn().catch(() => {});
              schedule();
            }
          }, stagger);
        } else {
          schedule();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, fetchFn, schedule, pauseWhenHidden, refreshOnVisible]);
}
