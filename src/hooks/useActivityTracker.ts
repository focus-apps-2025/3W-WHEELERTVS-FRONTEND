import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';

/**
 * Hook to track user activity, presence, and page focus.
 * Sends periodic heartbeats and logs page views.
 */
export const useActivityTracker = (enabled: boolean = true) => {
  const location = useLocation();
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 15));

  useEffect(() => {
    if (!enabled) return;

    // 1. Initial Page View
    const logPageView = async () => {
      try {
        await apiClient.sendHeartbeat({
          url: window.location.href,
          sessionId: sessionId.current
        });
      } catch (err) {
        // Silent fail for background tracking
      }
    };

    logPageView();

    // 2. Setup Heartbeat (every 30 seconds)
    heartbeatInterval.current = setInterval(async () => {
      try {
        await apiClient.sendHeartbeat({
          url: window.location.href,
          sessionId: sessionId.current
        });
      } catch (err) {
        // Silent fail
      }
    }, 30000);

    // 3. Track Focus/Blur
    const handleFocus = () => {
      apiClient.sendHeartbeat({
        url: window.location.href,
        sessionId: sessionId.current
      });
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      window.removeEventListener('focus', handleFocus);
    };
  }, [location.pathname, enabled]);

  return { sessionId: sessionId.current };
};
