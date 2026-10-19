import type {
  AlertType,
  AlertTypeCreate,
  AlertTypeUpdate,
  CatalogPage,
  CursorPagination,
  IndicatorsReportEntry,
  KpiStatus,
  KpiSummaryReportEntry,
  KpiTracking,
  KpiTrackingCreate,
  KpiType,
  KpiTypeCreate,
  KpiTypeUpdate,
  Pagination,
  RiskLevel,
} from '../../contracts/catalog-types.js';
import type { HttpClient, HttpRequest } from '../../application/ports/monitoring-catalogs.js';

type MockState = {
  kpiTypes: KpiType[];
  alertTypes: AlertType[];
  riskLevels: RiskLevel[];
  kpiStatuses: KpiStatus[];
  kpiTrackings: KpiTracking[];
};

const initialState: MockState = {
  kpiTypes: [
    { id: 'mock-kpi-attendance', code: 'ATTENDANCE', name: 'Asistencia', description: 'Porcentaje de asistencia de la ficha.', unit: 'PERCENTAGE', is_active: true },
    { id: 'mock-kpi-progress', code: 'CURRICULUM_PROGRESS', name: 'Avance curricular', description: 'Avance frente al plan curricular.', unit: 'PERCENTAGE', is_active: true },
    { id: 'mock-kpi-follow-up', code: 'FOLLOW_UP_COUNT', name: 'Seguimientos realizados', description: 'Cantidad de seguimientos registrados.', unit: 'COUNT', is_active: true },
    { id: 'mock-kpi-hours', code: 'PRODUCTIVE_HOURS', name: 'Horas productivas', description: 'Horas reportadas en etapa productiva.', unit: 'HOURS', is_active: false },
  ],
  alertTypes: [
    { id: 'mock-alert-attendance', code: 'LOW_ATTENDANCE', name: 'Baja asistencia', description: 'La asistencia está por debajo del umbral configurado.', default_threshold: 80, threshold_unit: 'PERCENTAGE', affects_ficha_status: true, is_active: true },
    { id: 'mock-alert-progress', code: 'LOW_PROGRESS', name: 'Bajo avance curricular', description: 'El avance curricular requiere revisión.', default_threshold: 60, threshold_unit: 'PERCENTAGE', affects_ficha_status: true, is_active: true },
    { id: 'mock-alert-follow-up', code: 'MISSING_FOLLOW_UP', name: 'Seguimiento pendiente', description: 'No se registra un seguimiento reciente.', default_threshold: 30, threshold_unit: 'DAYS', affects_ficha_status: false, is_active: true },
    { id: 'mock-alert-hours', code: 'PRODUCTIVE_STAGE_DELAY', name: 'Retraso en etapa productiva', description: 'Las horas productivas están por debajo de lo esperado.', default_threshold: 40, threshold_unit: 'HOURS', affects_ficha_status: false, is_active: false },
  ],
  riskLevels: [
    { id: 'mock-risk-info', code: 'INFO', label: 'Informativo', color_hex: '#175CD3', priority_order: 5 },
    { id: 'mock-risk-low', code: 'LOW', label: 'Bajo', color_hex: '#12B76A', priority_order: 4 },
    { id: 'mock-risk-medium', code: 'MEDIUM', label: 'Medio', color_hex: '#F79009', priority_order: 3 },
    { id: 'mock-risk-high', code: 'HIGH', label: 'Alto', color_hex: '#F04438', priority_order: 2 },
    { id: 'mock-risk-critical', code: 'CRITICAL', label: 'Crítico', color_hex: '#B42318', priority_order: 1 },
  ],
  kpiStatuses: [
    { id: 'mock-status-on-track', code: 'ON_TRACK', description: 'En seguimiento', risk_level_id: 'mock-risk-low' },
    { id: 'mock-status-at-risk', code: 'AT_RISK', description: 'En riesgo', risk_level_id: 'mock-risk-medium' },
    { id: 'mock-status-critical', code: 'CRITICAL', description: 'Crítico', risk_level_id: 'mock-risk-critical' },
    { id: 'mock-status-completed', code: 'COMPLETED', description: 'Completado', risk_level_id: 'mock-risk-info' },
  ],
  kpiTrackings: [
    {
      id: 'mock-kpi-tracking-1',
      ficha_tracking_id: 'mock-ficha-tracking-1',
      kpi_type_id: 'mock-kpi-attendance',
      current_value: 78,
      threshold_value: 80,
      kpi_status_id: 'mock-status-at-risk',
      period_start: '2026-09-01',
      period_end: '2026-09-30',
      measured_at: '2026-10-01T10:00:00Z',
    },
  ],
};

function cloneInitialState(): MockState {
  return {
    kpiTypes: initialState.kpiTypes.map((item) => ({ ...item })),
    alertTypes: initialState.alertTypes.map((item) => ({ ...item })),
    riskLevels: initialState.riskLevels.map((item) => ({ ...item })),
    kpiStatuses: initialState.kpiStatuses.map((item) => ({ ...item })),
    kpiTrackings: initialState.kpiTrackings.map((item) => ({ ...item })),
  };
}

export const demoCatalogs = {
  kpiTypes: initialState.kpiTypes.map((item) => ({ ...item })),
  kpiStatuses: initialState.kpiStatuses.map((item) => ({ ...item })),
};

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('El cuerpo del mock debe ser un objeto.');
  }
  return body as Record<string, unknown>;
}

function paginate<T>(items: T[], query?: Record<string, string | number | boolean | undefined>): CatalogPage<T> {
  const page = Number(query?.page ?? 1);
  const pageSize = Number(query?.page_size ?? 20);
  const start = (page - 1) * pageSize;
  const totalItems = items.length;
  return {
    data: items.slice(start, start + pageSize),
    pagination: {
      page,
      page_size: pageSize,
      total_items: totalItems,
      total_pages: Math.max(1, Math.ceil(totalItems / pageSize)),
    } satisfies Pagination,
  };
}

function filterCatalog<T extends { code: string; is_active: boolean }>(items: T[], query?: Record<string, string | number | boolean | undefined>) {
  return items.filter((item) => {
    const code = query?.code;
    const isActive = query?.is_active;
    return (!code || item.code.toLowerCase().includes(String(code).toLowerCase()))
      && (isActive === undefined || item.is_active === isActive);
  });
}

function nextId(prefix: string, items: Array<{ id: string }>) {
  return `mock-${prefix}-${items.length + 1}`;
}

function findId(path: string, resource: 'kpi-types' | 'alert-types') {
  const match = path.match(new RegExp(`^/api/v1/${resource}/([^/]+)$`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function createMockMonitoringClient(): HttpClient {
  const state = cloneInitialState();

  return {
    async request<TResponse>({ method, path, query, body }: HttpRequest): Promise<TResponse> {
      if (path === '/api/v1/kpi-types' && method === 'GET') {
        return paginate(filterCatalog(state.kpiTypes, query), query) as TResponse;
      }
      if (path === '/api/v1/kpi-types' && method === 'POST') {
        const payload = asRecord(body) as unknown as KpiTypeCreate;
        const created: KpiType = { id: nextId('kpi', state.kpiTypes), code: payload.code, name: payload.name, description: payload.description ?? null, unit: payload.unit, is_active: true };
        state.kpiTypes.push(created);
        return { ...created } as TResponse;
      }
      const kpiId = findId(path, 'kpi-types');
      if (kpiId && method === 'PUT') {
        const current = state.kpiTypes.find((item) => item.id === kpiId);
        if (!current) throw new Error('Tipo de KPI no encontrado en el mock.');
        const payload = asRecord(body) as unknown as KpiTypeUpdate;
        Object.assign(current, payload);
        return { ...current } as TResponse;
      }

      if (path === '/api/v1/alert-types' && method === 'GET') {
        return paginate(filterCatalog(state.alertTypes, query), query) as TResponse;
      }
      if (path === '/api/v1/alert-types' && method === 'POST') {
        const payload = asRecord(body) as unknown as AlertTypeCreate;
        const created: AlertType = { id: nextId('alert', state.alertTypes), code: payload.code, name: payload.name, description: payload.description ?? null, default_threshold: payload.default_threshold ?? null, threshold_unit: payload.threshold_unit ?? null, affects_ficha_status: payload.affects_ficha_status, is_active: true };
        state.alertTypes.push(created);
        return { ...created } as TResponse;
      }
      const alertId = findId(path, 'alert-types');
      if (alertId && method === 'PUT') {
        const current = state.alertTypes.find((item) => item.id === alertId);
        if (!current) throw new Error('Tipo de alerta no encontrado en el mock.');
        const payload = asRecord(body) as unknown as AlertTypeUpdate;
        Object.assign(current, payload);
        return { ...current } as TResponse;
      }

      if (path === '/api/v1/risk-levels' && method === 'GET') return state.riskLevels.map((item) => ({ ...item })) as TResponse;
      if (path === '/api/v1/kpi-statuses' && method === 'GET') return state.kpiStatuses.map((item) => ({ ...item })) as TResponse;

      if (path === '/api/v1/kpi-trackings' && method === 'GET') {
        return {
          data: state.kpiTrackings,
          pagination: { next_cursor: null, limit: Number(query?.limit ?? 50), has_more: false } satisfies CursorPagination,
        } as TResponse;
      }
      if (path === '/api/v1/kpi-trackings' && method === 'POST') {
        const payload = asRecord(body) as KpiTrackingCreate;
        const created: KpiTracking = {
          id: `mock-kpi-tracking-${state.kpiTrackings.length + 1}`,
          ficha_tracking_id: String(payload.ficha_tracking_id),
          kpi_type_id: String(payload.kpi_type_id),
          current_value: Number(payload.current_value),
          threshold_value: Number(payload.threshold_value),
          kpi_status_id: String(payload.kpi_status_id),
          period_start: String(payload.period_start),
          period_end: String(payload.period_end),
          measured_at: '2026-10-01T10:00:00Z',
        };
        state.kpiTrackings.push(created);
        return { ...created } as TResponse;
      }
      const kpiTrackingId = path.match(/^\/api\/v1\/kpi-trackings\/([^/]+)$/)?.[1];
      if (kpiTrackingId && method === 'GET') {
        const item = state.kpiTrackings.find((entry) => entry.id === decodeURIComponent(kpiTrackingId));
        if (!item) throw new Error('Medición KPI no encontrada en el mock.');
        return { ...item } as TResponse;
      }
      if (path === '/api/v1/reports/kpi-summary' && method === 'GET') {
        const data = state.kpiTrackings.map((item) => {
          const kpiType = state.kpiTypes.find((entry) => entry.id === item.kpi_type_id);
          const status = state.kpiStatuses.find((entry) => entry.id === item.kpi_status_id);
          return {
            ficha_tracking_id: item.ficha_tracking_id,
            kpi_type_code: kpiType?.code ?? item.kpi_type_id,
            kpi_type_name: kpiType?.name ?? item.kpi_type_id,
            current_value: item.current_value,
            unit: kpiType?.unit ?? 'PERCENTAGE',
            threshold_value: item.threshold_value,
            kpi_status_code: status?.code ?? item.kpi_status_id,
            risk_level_code: 'MEDIUM',
            period_start: item.period_start,
            period_end: item.period_end,
            measured_at: item.measured_at,
          } satisfies KpiSummaryReportEntry;
        });
        return {
          data,
          pagination: { page: 1, page_size: 20, total_items: data.length, total_pages: 1 } satisfies Pagination,
        } as TResponse;
      }
      if (path === '/api/v1/reports/indicators' && method === 'GET') {
        const data: IndicatorsReportEntry[] = [{
          kpi_status_code: 'AT_RISK',
          risk_level_code: 'MEDIUM',
          ficha_count: 1,
          avg_active_alert_count: 1,
          as_of: '2026-10-01T10:00:00Z',
        }];
        return {
          data,
          pagination: { page: 1, page_size: 20, total_items: data.length, total_pages: 1 } satisfies Pagination,
        } as TResponse;
      }

      throw new Error(`Ruta no disponible en el mock: ${method} ${path}`);
    },
  };
}
