import { useCallback, useEffect, useRef, useState } from 'react';

import type { GeneratedAlert, GeneratedAlertResolve } from '../../contracts/alerts-plans-types.js';
import type { AlertListParams, AlertsPlansPort } from '../ports/alerts-plans.js';

const PAGE_LIMIT = 50;

export type AlertFilters = Pick<AlertListParams, 'alertType' | 'riskLevel' | 'isResolved'>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** E1 + E2: listar alertas generadas (cursor) y resolverlas (PUT .../resolve). */
export function useGeneratedAlerts(api: AlertsPlansPort, enabled = true) {
  const [data, setData] = useState<GeneratedAlert[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const filtersRef = useRef<AlertFilters>({});
  const requestRef = useRef(0);

  /** Con `filters` reinicia la lista; sin argumentos refresca con los filtros activos. */
  const load = useCallback(
    async (filters?: AlertFilters) => {
      if (filters) {
        filtersRef.current = filters;
        setData([]);
      }
      const requestId = ++requestRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const page = await api.listGeneratedAlerts({ ...filtersRef.current, limit: PAGE_LIMIT });
        if (requestId !== requestRef.current) return;
        setData(page.data);
        setNextCursor(page.pagination.next_cursor ?? null);
        setHasMore(page.pagination.has_more);
      } catch (loadError) {
        if (requestId === requestRef.current) {
          setError(getErrorMessage(loadError, 'No fue posible consultar las alertas. Intenta de nuevo.'));
        }
      } finally {
        if (requestId === requestRef.current) setIsLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoading) return;
    const requestId = ++requestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const page = await api.listGeneratedAlerts({ ...filtersRef.current, cursor: nextCursor, limit: PAGE_LIMIT });
      if (requestId !== requestRef.current) return;
      setData((items) => {
        const known = new Set(items.map((item) => item.id));
        return [...items, ...page.data.filter((item) => !known.has(item.id))];
      });
      setNextCursor(page.pagination.next_cursor ?? null);
      setHasMore(page.pagination.has_more);
    } catch (loadError) {
      if (requestId === requestRef.current) {
        setError(getErrorMessage(loadError, 'No fue posible consultar las alertas. Intenta de nuevo.'));
      }
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }, [api, hasMore, isLoading, nextCursor]);

  const resolve = useCallback(
    async (id: string, payload: GeneratedAlertResolve) => {
      setIsResolving(true);
      setResolveError(null);
      let resolved: GeneratedAlert;
      try {
        resolved = await api.resolveGeneratedAlert(id, payload);
      } catch (failure) {
        setResolveError(getErrorMessage(failure, 'No fue posible resolver la alerta. Intenta de nuevo.'));
        throw failure;
      } finally {
        setIsResolving(false);
      }
      void load();
      return resolved;
    },
    [api, load],
  );

  const resetResolveError = useCallback(() => setResolveError(null), []);

  return { data, hasMore, isLoading, error, isResolving, resolveError, load, loadMore, resolve, resetResolveError };
}