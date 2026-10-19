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

export type QueryValue = string | number | boolean | undefined;

export interface HttpRequest {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

/** The narrow frontend-platform facade required by this MFE. */
export interface HttpClient {
  request<TResponse>(request: HttpRequest): Promise<TResponse>;
}

export interface CatalogListParams {
  page: number;
  pageSize: number;
  code?: string;
  isActive?: boolean;
}

export interface MonitoringCatalogPort {
  listKpiTypes(params?: Partial<CatalogListParams>): Promise<CatalogPage<KpiType>>;
  createKpiType(payload: KpiTypeCreate): Promise<KpiType>;
  updateKpiType(id: string, payload: KpiTypeUpdate): Promise<KpiType>;

  listAlertTypes(params?: Partial<CatalogListParams>): Promise<CatalogPage<AlertType>>;
  createAlertType(payload: AlertTypeCreate): Promise<AlertType>;
  updateAlertType(id: string, payload: AlertTypeUpdate): Promise<AlertType>;

  listRiskLevels(): Promise<RiskLevel[]>;
  listKpiStatuses(): Promise<KpiStatus[]>;
}

export class MonitoringApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly details?: Array<{ field?: string; issue?: string }>;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      details?: Array<{ field?: string; issue?: string }>;
    } = {},
  ) {
    super(message);
    this.name = 'MonitoringApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}
