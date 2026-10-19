import { useCallback, useEffect, useRef, useState } from 'react';

import type { FichaTracking } from '../../contracts/tracking-types.js';
import type { FichaTrackingPort } from '../ports/ficha-tracking.js';

const LIST_PAGE_SIZE = 100;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * E1: lista GET /ficha-trackings?ficha_id= (todos los seguimientos de la ficha).
 * E3: al hacer click en una fila (select) consulta GET /ficha-trackings/{id}.
 * ficha_tracking es de solo lectura en el contrato: no hay create.
 */
export function useFichaTrackings(api: FichaTrackingPort, fichaId: string | undefined) {
  const [items, setItems] = useState<FichaTracking[]>([]);
  const [selected, setSelected] = useState<FichaTracking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const selectedIdRef = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    const requestId = ++listRequestRef.current;
    detailRequestRef.current += 1;
    selectedIdRef.current = undefined;
    setItems([]);
    setSelected(null);
    setError(null);
    setDetailError(null);
    setIsLoadingDetail(false);
    if (!fichaId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const list = await api.listFichaTrackings(fichaId, { page: 1, pageSize: LIST_PAGE_SIZE });
      if (requestId !== listRequestRef.current) return;
      setItems(list.data);
    } catch (loadError) {
      if (requestId === listRequestRef.current) {
        setError(getErrorMessage(loadError, 'No fue posible consultar el seguimiento. Intenta de nuevo.'));
      }
    } finally {
      if (requestId === listRequestRef.current) setIsLoading(false);
    }
  }, [api, fichaId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** E3: click en una fila -> GET /ficha-trackings/{id}. */
  const select = useCallback(
    async (id: string) => {
      const requestId = ++detailRequestRef.current;
      // QA: limpiar el detalle anterior mientras llega la nueva respuesta.
      selectedIdRef.current = undefined;
      setSelected(null);
      setIsLoadingDetail(true);
      setDetailError(null);
      try {
        const detail = await api.getFichaTracking(id);
        if (requestId !== detailRequestRef.current) return;
        selectedIdRef.current = detail.id;
        setSelected(detail);
      } catch (detailLoadError) {
        if (requestId === detailRequestRef.current) {
          setDetailError(getErrorMessage(detailLoadError, 'No fue posible consultar el detalle del seguimiento.'));
        }
      } finally {
        if (requestId === detailRequestRef.current) setIsLoadingDetail(false);
      }
    },
    [api],
  );

  /** Refresca el seguimiento seleccionado (ultimo seguimiento) sin estado de carga. */
  const refresh = useCallback(async () => {
    const id = selectedIdRef.current;
    if (!id) return;
    try {
      const detail = await api.getFichaTracking(id);
      if (selectedIdRef.current !== id) return;
      setSelected(detail);
      setItems((current) => current.map((item) => (item.id === detail.id ? detail : item)));
    } catch (refreshError) {
      // Se conserva el ultimo resumen conocido.
      console.warn('No se pudo refrescar el seguimiento de ficha', refreshError);
    }
  }, [api]);

  return { items, selected, isLoading, isLoadingDetail, error, detailError, reload: load, select, refresh };
}