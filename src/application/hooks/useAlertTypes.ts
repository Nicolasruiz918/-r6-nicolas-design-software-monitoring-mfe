import { useMemo } from 'react';

import type {
  AlertType,
  AlertTypeCreate,
  AlertTypeUpdate,
} from '../../contracts/catalog-types.js';
import type { MonitoringCatalogPort } from '../ports/monitoring-catalogs.js';
import { useMutableCatalogResource } from './useCatalogResource.js';

export function useAlertTypes(api: MonitoringCatalogPort) {
  const options = useMemo(
    () => ({
      list: (params: Parameters<MonitoringCatalogPort['listAlertTypes']>[0] = {}) =>
        api.listAlertTypes(params),
      createResource: (payload: AlertTypeCreate) => api.createAlertType(payload),
      updateResource: (id: string, payload: AlertTypeUpdate) => api.updateAlertType(id, payload),
    }),
    [api],
  );

  return useMutableCatalogResource<AlertType, AlertTypeCreate, AlertTypeUpdate>(options);
}
