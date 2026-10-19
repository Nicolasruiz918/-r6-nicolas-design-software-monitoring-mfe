import { useCallback, useEffect, useRef, useState } from 'react';
import type { KpiTracking, KpiTrackingCreate } from '../../contracts/catalog-types.js';
import type { KpiTrackingListParams, MonitoringPort } from '../ports/monitoring.js';

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'No fue posible consultar los seguimientos.';
const PAGE_SIZE = 50;

export function useKpiTrackings(api: MonitoringPort) {
  const [data, setData] = useState<KpiTracking[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KpiTracking | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const activeParams = useRef<KpiTrackingListParams>({ limit: PAGE_SIZE });

  const load = useCallback(async (params: KpiTrackingListParams = {}) => {
    const requestParams = { ...params, cursor: undefined, limit: params.limit ?? PAGE_SIZE };
    activeParams.current = requestParams;
    setIsLoading(true); setError(null);
    try {
      const page = await api.listKpiTrackings(requestParams);
      setData(page.data); setNextCursor(page.pagination.next_cursor ?? null); setHasMore(page.pagination.has_more);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setIsLoading(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoading) return;

    setIsLoading(true); setError(null);
    try {
      const page = await api.listKpiTrackings({
        ...activeParams.current,
        cursor: nextCursor,
        limit: activeParams.current.limit ?? PAGE_SIZE,
      });
      setData((items) => {
        const existingIds = new Set(items.map((item) => item.id));
        const newItems = page.data.filter((item) => {
          if (existingIds.has(item.id)) return false;
          existingIds.add(item.id);
          return true;
        });
        return [...items, ...newItems];
      });
      setNextCursor(page.pagination.next_cursor ?? null); setHasMore(page.pagination.has_more);
    } catch (cause) { setError(messageOf(cause)); }
    finally { setIsLoading(false); }
  }, [api, hasMore, isLoading, nextCursor]);

  const openDetail = useCallback(async (id: string) => {
    setDetailLoading(true); setDetailError(null);
    try { setSelected(await api.getKpiTracking(id)); }
    catch (cause) { setDetailError(messageOf(cause)); }
    finally { setDetailLoading(false); }
  }, [api]);

  const create = useCallback(async (payload: KpiTrackingCreate) => {
    setIsCreating(true); setError(null);
    try { const created = await api.createKpiTracking(payload); setData((items) => [created, ...items]); return created; }
    catch (cause) { setError(messageOf(cause)); throw cause; }
    finally { setIsCreating(false); }
  }, [api]);

  const closeDetail = useCallback(() => {
    setSelected(null);
    setDetailError(null);
    setDetailLoading(false);
  }, []);

  return { data, nextCursor, hasMore, isLoading, error, load, loadMore, selected, openDetail, closeDetail, detailLoading, detailError, create, isCreating };
}

