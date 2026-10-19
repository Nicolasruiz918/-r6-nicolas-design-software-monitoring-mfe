import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  CatalogListParams,
  MonitoringCatalogPort,
} from '../ports/monitoring-catalogs.js';
import type { CatalogPage, Pagination } from '../../contracts/catalog-types.js';

export interface CatalogResourceState<T> {
  data: T[];
  pagination: Pagination | null;
  params: CatalogListParams;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  load: (params?: Partial<CatalogListParams>) => Promise<void>;
}

export interface MutableCatalogResourceState<T, TCreate, TUpdate>
  extends CatalogResourceState<T> {
  create: (payload: TCreate) => Promise<T>;
  update: (id: string, payload: TUpdate) => Promise<T>;
}

const DEFAULT_PARAMS: CatalogListParams = { page: 1, pageSize: 20 };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'No fue posible consultar el catálogo. Intenta de nuevo.';
}

export function useMutableCatalogResource<T, TCreate, TUpdate>(options: {
  list: (params: Partial<CatalogListParams>) => Promise<CatalogPage<T>>;
  createResource: (payload: TCreate) => Promise<T>;
  updateResource: (id: string, payload: TUpdate) => Promise<T>;
}): MutableCatalogResourceState<T, TCreate, TUpdate> {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [params, setParams] = useState<CatalogListParams>(DEFAULT_PARAMS);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paramsRef = useRef(params);

  const load = useCallback(
    async (nextParams: Partial<CatalogListParams> = paramsRef.current) => {
      const resolvedParams = { ...DEFAULT_PARAMS, ...nextParams };
      paramsRef.current = resolvedParams;
      setParams(resolvedParams);
      setIsLoading(true);
      setError(null);

      try {
        const result = await options.list(resolvedParams);
        setData(result.data);
        setPagination(result.pagination);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    },
    [options],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (payload: TCreate) => {
      setIsMutating(true);
      setError(null);
      try {
        const created = await options.createResource(payload);
        await load(paramsRef.current);
        return created;
      } catch (mutationError) {
        setError(getErrorMessage(mutationError));
        throw mutationError;
      } finally {
        setIsMutating(false);
      }
    },
    [load, options],
  );

  const update = useCallback(
    async (id: string, payload: TUpdate) => {
      setIsMutating(true);
      setError(null);
      try {
        const updated = await options.updateResource(id, payload);
        await load(paramsRef.current);
        return updated;
      } catch (mutationError) {
        setError(getErrorMessage(mutationError));
        throw mutationError;
      } finally {
        setIsMutating(false);
      }
    },
    [load, options],
  );

  return { data, pagination, params, isLoading, isMutating, error, load, create, update };
}

export interface ReadonlyCatalogResourceState<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useReadonlyCatalogResource<T>(list: () => Promise<T[]>): ReadonlyCatalogResourceState<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await list());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [list]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, isLoading, error, reload };
}

export function getResourcePort(api: MonitoringCatalogPort): MonitoringCatalogPort {
  return api;
}
