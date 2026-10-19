import { useCallback } from 'react';

import type { KpiStatus } from '../../contracts/catalog-types.js';
import type { MonitoringCatalogPort } from '../ports/monitoring-catalogs.js';
import { useReadonlyCatalogResource } from './useCatalogResource.js';

export function useKpiStatuses(api: MonitoringCatalogPort) {
  const list = useCallback(() => api.listKpiStatuses(), [api]);
  return useReadonlyCatalogResource<KpiStatus>(list);
}
