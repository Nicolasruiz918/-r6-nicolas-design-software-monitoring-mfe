import { useCallback } from 'react';

import type { RiskLevel } from '../../contracts/catalog-types.js';
import type { MonitoringCatalogPort } from '../ports/monitoring-catalogs.js';
import { useReadonlyCatalogResource } from './useCatalogResource.js';

export function useRiskLevels(api: MonitoringCatalogPort) {
  const list = useCallback(() => api.listRiskLevels(), [api]);
  return useReadonlyCatalogResource<RiskLevel>(list);
}
