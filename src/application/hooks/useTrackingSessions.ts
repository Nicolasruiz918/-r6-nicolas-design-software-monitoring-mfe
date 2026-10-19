import { useCallback, useEffect, useRef, useState } from 'react';

import type { Pagination } from '../../contracts/catalog-types.js';
import type { TrackingSession, TrackingSessionCreate } from '../../contracts/tracking-types.js';
import type { FichaTrackingPort } from '../ports/ficha-tracking.js';

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 10;
/** Mas reciente primero (prototipo). Formato del contrato: <campo>:<asc|desc>. */
const SESSION_SORT = 'session_date:desc';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** E4 + E5: listar, ver detalle y registrar sesiones de un seguimiento de ficha. */
export function useTrackingSessions(api: FichaTrackingPort, trackingId: string | undefined) {
  const [data, setData] = useState<TrackingSession[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(DEFAULT_PAGE_SIZE);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSession, setSelectedSession] = useState<TrackingSession | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const lastDetailIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Cambio de seguimiento: se descarta el detalle abierto y cualquier consulta en vuelo.
    detailRequestRef.current += 1;
    lastDetailIdRef.current = null;
    setPage(1);
    setSelectedSession(null);
    setDetailError(null);
    setIsDetailOpen(false);
    setIsLoadingDetail(false);
  }, [trackingId]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    if (!trackingId) {
      setData([]);
      setPagination(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    async function run(id: string) {
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.listTrackingSessions(id, { page, pageSize, sort: SESSION_SORT });
        if (requestId !== requestRef.current) return;
        setData(result.data);
        setPagination(result.pagination);
      } catch (loadError) {
        if (requestId === requestRef.current) {
          setError(getErrorMessage(loadError, 'No fue posible consultar las sesiones. Intenta de nuevo.'));
        }
      } finally {
        if (requestId === requestRef.current) setIsLoading(false);
      }
    }
    void run(trackingId);
  }, [api, trackingId, page, pageSize, reloadKey]);

  const changePageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  /**
   * E5: GET .../tracking-sessions/{session_id}.
   * Abre el detalle de inmediato (estado de carga), limpia el detalle anterior
   * e ignora respuestas que lleguen fuera de orden.
   */
  const loadDetail = useCallback(
    async (sessionId: string) => {
      if (!trackingId) return;
      const requestId = ++detailRequestRef.current;
      lastDetailIdRef.current = sessionId;
      setIsDetailOpen(true);
      setSelectedSession(null);
      setDetailError(null);
      setIsLoadingDetail(true);
      try {
        const detail = await api.getTrackingSession(trackingId, sessionId);
        if (requestId !== detailRequestRef.current) return;
        setSelectedSession(detail);
      } catch (detailLoadError) {
        if (requestId === detailRequestRef.current) {
          setDetailError(getErrorMessage(detailLoadError, 'No fue posible consultar la sesión. Intenta de nuevo.'));
        }
      } finally {
        if (requestId === detailRequestRef.current) setIsLoadingDetail(false);
      }
    },
    [api, trackingId],
  );

  const retryDetail = useCallback(() => {
    const id = lastDetailIdRef.current;
    if (id) void loadDetail(id);
  }, [loadDetail]);

  /** Cierra el detalle e invalida cualquier consulta en vuelo. */
  const clearSelected = useCallback(() => {
    detailRequestRef.current += 1;
    lastDetailIdRef.current = null;
    setIsDetailOpen(false);
    setSelectedSession(null);
    setDetailError(null);
    setIsLoadingDetail(false);
  }, []);

  const create = useCallback(
    async (payload: TrackingSessionCreate) => {
      if (!trackingId) throw new Error('No hay un seguimiento de ficha seleccionado.');
      setIsMutating(true);
      setMutationError(null);
      try {
        const created = await api.createTrackingSession(trackingId, payload);
        setPage(1);
        setReloadKey((key) => key + 1);
        return created;
      } catch (mutationFailure) {
        setMutationError(getErrorMessage(mutationFailure, 'No fue posible registrar la sesión. Intenta de nuevo.'));
        throw mutationFailure;
      } finally {
        setIsMutating(false);
      }
    },
    [api, trackingId],
  );

  const resetMutationError = useCallback(() => setMutationError(null), []);

  return {
    data,
    pagination,
    page,
    pageSize,
    selectedSession,
    isDetailOpen,
    isLoading,
    isLoadingDetail,
    isMutating,
    error,
    detailError,
    mutationError,
    setPage,
    changePageSize,
    reload,
    loadDetail,
    retryDetail,
    clearSelected,
    create,
    resetMutationError,
  };
}