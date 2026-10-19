import type {
  CursorPagination,
  IndicatorsReportEntry,
  KpiSummaryReportEntry,
  KpiTracking,
  KpiTrackingCreate,
  Pagination,
} from '../../contracts/catalog-types.js';

export type QueryValue = string | number | boolean | undefined;

export interface HttpRequest {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface HttpClient {
  request<T>(request: HttpRequest): Promise<T>;
}

export interface KpiTrackingListParams {
  cursor?: string;
  limit?: number;
  fichaTrackingId?: string;
  kpiType?: string;
  kpiStatus?: string;
  from?: string;
  to?: string;
}

export interface ReportParams {
  page?: number;
  pageSize?: number;
  fichaTrackingId?: string;
  kpiType?: string;
  status?: string;
  from?: string;
  to?: string;
}

export interface KpiTrackingPage {
  data: KpiTracking[];
  pagination: CursorPagination;
}

export interface ReportPage<T> {
  data: T[];
  pagination: Pagination;
}

export interface MonitoringPort {
  listKpiTrackings(params?: KpiTrackingListParams): Promise<KpiTrackingPage>;
  createKpiTracking(payload: KpiTrackingCreate): Promise<KpiTracking>;
  getKpiTracking(id: string): Promise<KpiTracking>;
  getKpiSummary(params?: ReportParams): Promise<ReportPage<KpiSummaryReportEntry>>;
  getIndicators(params?: ReportParams): Promise<ReportPage<IndicatorsReportEntry>>;
}

