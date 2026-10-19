import { useCallback, useEffect, useRef, useState } from 'react';

import type { Pagination } from '../../contracts/catalog-types.js';
import type { ImprovementPlan, ImprovementPlanCreate, PlanStatus } from '../../contracts/alerts-plans-types.js';
import type { AlertsPlansPort } from '../ports/alerts-plans.js';

const PAGE_SIZE = 20;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** E3 + E4: listar (filtrando por status) y crear planes de mejoramiento. */
export function useImprovementPlans(api: AlertsPlansPort, enabled = true) {
  const [data, setData] = useState<ImprovementPlan[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PlanStatus | ''>('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const requestId = ++requestRef.current;
    async function run() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.listImprovementPlans({
          page,
          pageSize: PAGE_SIZE,
          status: status === '' ? undefined : status,
        });
        if (requestId !== requestRef.current) return;
        setData(result.data);
        setPagination(result.pagination);
      } catch (loadError) {
        if (requestId === requestRef.current) {
          setError(getErrorMessage(loadError, 'No fue posible consultar los planes. Intenta de nuevo.'));
        }
      } finally {
        if (requestId === requestRef.current) setIsLoading(false);
      }
    }
    void run();
  }, [api, enabled, page, status, reloadKey]);

  const changeStatus = useCallback((next: PlanStatus | '') => {
    setStatus(next);
    setPage(1);
  }, []);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const create = useCallback(
    async (payload: ImprovementPlanCreate) => {
      setIsMutating(true);
      setMutationError(null);
      try {
        const created = await api.createImprovementPlan(payload);
        setPage(1);
        setReloadKey((key) => key + 1);
        return created;
      } catch (failure) {
        setMutationError(getErrorMessage(failure, 'No fue posible crear el plan. Intenta de nuevo.'));
        throw failure;
      } finally {
        setIsMutating(false);
      }
    },
    [api],
  );

  const resetMutationError = useCallback(() => setMutationError(null), []);

  return { data, pagination, status, isLoading, error, isMutating, mutationError, setPage, changeStatus, reload, create, resetMutationError };
}