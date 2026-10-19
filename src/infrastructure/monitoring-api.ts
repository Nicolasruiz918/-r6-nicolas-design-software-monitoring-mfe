import type { HttpClient, HttpRequest } from '../application/ports/monitoring.js';
import type {
  KpiTrackingCreate,
  KpiTracking,
  KpiSummaryReportEntry,
  IndicatorsReportEntry,
  CursorPagination,
} from '../contracts/catalog-types.js';
import type {
  KpiTrackingListParams,
  MonitoringPort,
  ReportPage,
  ReportParams,
} from '../application/ports/monitoring.js';

const path = (id: string) => `/api/v1/kpi-trackings/${encodeURIComponent(id)}`;

const listQuery = (params: KpiTrackingListParams = {}) => ({
  cursor: params.cursor,
  limit: params.limit,
  ficha_tracking_id: params.fichaTrackingId,
  kpi_type: params.kpiType,
  kpi_status: params.kpiStatus,
  from: params.from,
  to: params.to,
});

const reportQuery = (params: ReportParams = {}) => ({
  page: params.page,
  page_size: params.pageSize,
  ficha_tracking_id: params.fichaTrackingId,
  kpi_type: params.kpiType,
  status: params.status,
  from: params.from,
  to: params.to,
});

export function createMonitoringApi(httpClient: HttpClient): MonitoringPort {
  return {
    listKpiTrackings: (params) => httpClient.request<{ data: KpiTracking[]; pagination: CursorPagination }>({
      method: 'GET', path: '/api/v1/kpi-trackings', query: listQuery(params),
    }),
    createKpiTracking: (payload: KpiTrackingCreate) => httpClient.request<KpiTracking>({
      method: 'POST', path: '/api/v1/kpi-trackings', body: payload,
    }),
    getKpiTracking: (id) => httpClient.request<KpiTracking>({ method: 'GET', path: path(id) }),
    getKpiSummary: (params) => httpClient.request<ReportPage<KpiSummaryReportEntry>>({
      method: 'GET', path: '/api/v1/reports/kpi-summary', query: reportQuery(params),
    }),
    getIndicators: (params) => httpClient.request<ReportPage<IndicatorsReportEntry>>({
      method: 'GET', path: '/api/v1/reports/indicators', query: {
        page: params?.page,
        page_size: params?.pageSize,
        status: params?.status,
      },
    }),
  };
}
export function createFetchHttpClient(baseUrl = ''): HttpClient {
  return {
    async request<T>({ method, path, query, body, signal }: HttpRequest) {
      const url = new URL(`${baseUrl}${path}`, window.location.origin);
      Object.entries(query ?? {}).forEach(([key, value]) => {
        if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
      });
      const response = await fetch(url, {
        method,
        signal,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error(`La solicitud falló (${response.status}).`);
      return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
    },
  };
}


