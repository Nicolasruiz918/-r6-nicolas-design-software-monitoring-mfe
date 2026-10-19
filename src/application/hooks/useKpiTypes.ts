import { useMemo } from 'react';

import type { KpiType, KpiTypeCreate, KpiTypeUpdate } from '../../contracts/catalog-types.js';
import type { MonitoringCatalogPort } from '../ports/monitoring-catalogs.js';
import { useMutableCatalogResource } from './useCatalogResource.js';

export function useKpiTypes(api: MonitoringCatalogPort) {
  const options = useMemo(
    () => ({
      list: (params: Parameters<MonitoringCatalogPort['listKpiTypes']>[0] = {}) =>
        api.listKpiTypes(params),
      createResource: (payload: KpiTypeCreate) => api.createKpiType(payload),
      updateResource: (id: string, payload: KpiTypeUpdate) => api.updateKpiType(id, payload),
    }),
    [api],
  );

  return useMutableCatalogResource<KpiType, KpiTypeCreate, KpiTypeUpdate>(options);
}
