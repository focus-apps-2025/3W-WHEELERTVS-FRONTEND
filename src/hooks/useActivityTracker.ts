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

  const lastLoggedPath = useRef<string | null>(null);
  const lastHeartbeatTime = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    // 1. Initial Page View (only if path changed)
    const logPageView = async () => {
      if (lastLoggedPath.current === location.pathname) return;
      
      try {
        await apiClient.sendHeartbeat({
          url: window.location.href,
          sessionId: sessionId.current
        });
        lastLoggedPath.current = location.pathname;
        lastHeartbeatTime.current = Date.now();
      } catch (err) {
        // Silent fail for background tracking
      }
    };

    logPageView();

    // 2. Setup Heartbeat (every 30 seconds)
    heartbeatInterval.current = setInterval(async () => {
      // Don't send if we just sent one via page view or focus
      if (Date.now() - lastHeartbeatTime.current < 25000) return;

      try {
        await apiClient.sendHeartbeat({
          url: window.location.href,
          sessionId: sessionId.current
        });
        lastHeartbeatTime.current = Date.now();
      } catch (err) {
        // Silent fail
      }
    }, 30000);

    // 3. Track Focus/Blur with throttling
    const handleFocus = () => {
      if (Date.now() - lastHeartbeatTime.current < 10000) return;
      
      apiClient.sendHeartbeat({
        url: window.location.href,
        sessionId: sessionId.current
      });
      lastHeartbeatTime.current = Date.now();
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
