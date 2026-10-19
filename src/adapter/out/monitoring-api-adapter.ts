import type {
  AlertType,
  AlertTypeCreate,
  AlertTypeUpdate,
  CatalogPage,
  KpiStatus,
  KpiType,
  KpiTypeCreate,
  KpiTypeUpdate,
  RiskLevel,
} from '../../contracts/catalog-types.js';
import type {
  CatalogListParams,
  HttpClient,
  MonitoringCatalogPort,
} from '../../application/ports/monitoring-catalogs.js';

const API_PREFIX = '/api/v1';

function buildCatalogQuery(params: Partial<CatalogListParams> = {}) {
  const query: Record<string, string | number | boolean> = {
    page: params.page ?? 1,
    page_size: params.pageSize ?? 20,
  };

  if (params.code) query.code = params.code;
  if (params.isActive !== undefined) query.is_active = params.isActive;
  return query;
}

export class MonitoringApiAdapter implements MonitoringCatalogPort {
  constructor(private readonly httpClient: HttpClient) {}

  listKpiTypes(params?: Partial<CatalogListParams>): Promise<CatalogPage<KpiType>> {
    return this.httpClient.request({
      method: 'GET',
      path: `${API_PREFIX}/kpi-types`,
      query: buildCatalogQuery(params),
    });
  }

  createKpiType(payload: KpiTypeCreate): Promise<KpiType> {
    return this.httpClient.request({
      method: 'POST',
      path: `${API_PREFIX}/kpi-types`,
      body: payload,
    });
  }

  updateKpiType(id: string, payload: KpiTypeUpdate): Promise<KpiType> {
    return this.httpClient.request({
      method: 'PUT',
      path: `${API_PREFIX}/kpi-types/${encodeURIComponent(id)}`,
      body: payload,
    });
  }

  listAlertTypes(params?: Partial<CatalogListParams>): Promise<CatalogPage<AlertType>> {
    return this.httpClient.request({
      method: 'GET',
      path: `${API_PREFIX}/alert-types`,
      query: buildCatalogQuery(params),
    });
  }

  createAlertType(payload: AlertTypeCreate): Promise<AlertType> {
    return this.httpClient.request({
      method: 'POST',
      path: `${API_PREFIX}/alert-types`,
      body: payload,
    });
  }

  updateAlertType(id: string, payload: AlertTypeUpdate): Promise<AlertType> {
    return this.httpClient.request({
      method: 'PUT',
      path: `${API_PREFIX}/alert-types/${encodeURIComponent(id)}`,
      body: payload,
    });
  }

  listRiskLevels(): Promise<RiskLevel[]> {
    return this.httpClient.request({ method: 'GET', path: `${API_PREFIX}/risk-levels` });
  }

  listKpiStatuses(): Promise<KpiStatus[]> {
    return this.httpClient.request({ method: 'GET', path: `${API_PREFIX}/kpi-statuses` });
  }
}
