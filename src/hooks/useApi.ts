import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient, ApiError } from "../api/client";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T>(
  apiFunction: (...args: any[]) => Promise<T>,
  immediate: boolean = false,
  pollInterval?: number,
  enabled: boolean = true,
  cacheEndpoint?: string
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>(() => {
    if (cacheEndpoint) {
      const cached = apiClient.getCachedData<T>(cacheEndpoint);
      if (cached) {
        return { data: cached, loading: false, error: null };
      }
    }
    return {
      data: null,
      loading: immediate && enabled,
      error: null,
    };
  });

  // Store the latest apiFunction in a ref to avoid stale closures
  const apiFunctionRef = useRef(apiFunction);
  apiFunctionRef.current = apiFunction;

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      const hasCache = cacheEndpoint && apiClient.getCachedData(cacheEndpoint) !== null;
      if (!hasCache) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      }

      try {
        const result = await apiFunctionRef.current(...args);
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err) {
        const error =
          err instanceof ApiError ? err.message : "An error occurred";
        setState({ data: null, loading: false, error });
        return null;
      }
    },
    [cacheEndpoint]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  useEffect(() => {
    if (immediate && enabled) {
      execute();
    }
  }, [execute, immediate, enabled]);

  useEffect(() => {
    if (pollInterval && pollInterval > 0 && enabled) {
      const interval = setInterval(() => {
        execute();
      }, pollInterval);
      return () => clearInterval(interval);
    }
  }, [execute, pollInterval, enabled]);

  return {
    ...state,
    execute,
    reset,
  };
}

// Specific hooks for common operations
export function useForms(enabled: boolean = true) {
  return useApi(apiClient.getForms.bind(apiClient), true, 0, enabled, "/forms");
}

export function useResponses() {
  return useApi(apiClient.getResponses.bind(apiClient), true, 0, true, "/responses");
}

export function useUsers() {
  return useApi(apiClient.getUsers.bind(apiClient), true, 0, true, "/users");
}

export function useRoles() {
  return useApi(apiClient.getRoles.bind(apiClient), true, 0, true, "/roles");
}

export function useDashboardAnalytics() {
  return useApi(apiClient.getDashboardAnalytics.bind(apiClient), true, 0, true, "/analytics/dashboard");
}

export function useFormAnalytics(formId: string) {
  const getFormAnalytics = useCallback(
    () => apiClient.getFormAnalytics(formId),
    [formId]
  );
  return useApi(getFormAnalytics, !!formId, 0, true, `/forms/${formId}/analytics`);
}

export function useFormResponses(formId: string) {
  const getFormResponses = useCallback(
    () => apiClient.getFormResponses(formId),
    [formId]
  );
  return useApi(getFormResponses, !!formId, 0, true, `/responses/form/${formId}`);
}

// Hook for mutations with optimistic updates
export function useMutation<T, P>(
  mutationFn: (params: P) => Promise<T>,
  options?: {
    onSuccess?: (data: T, params: P) => void;
    onError?: (error: string, params: P) => void;
  }
) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
  }>({
    loading: false,
    error: null,
  });

  const mutate = useCallback(
    async (params: P): Promise<T | null> => {
      setState({ loading: true, error: null });

      try {
        const result = await mutationFn(params);
        setState({ loading: false, error: null });
        options?.onSuccess?.(result, params);
        return result;
      } catch (err) {
        const error =
          err instanceof ApiError ? err.message : "An error occurred";
        setState({ loading: false, error });
        options?.onError?.(error, params);
        return null;
      }
    },
    [mutationFn, options]
  );

  return {
    ...state,
    mutate,
  };
}
