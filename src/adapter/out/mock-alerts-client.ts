import type { CatalogPage, Pagination } from '../../contracts/catalog-types.js';
import type { GeneratedAlert, ImprovementPlan, ImprovementPlanCreate } from '../../contracts/alerts-plans-types.js';
import type { HttpClient, HttpRequest } from '../../application/ports/monitoring-catalogs.js';
import { createMockTrackingClient } from './mock-tracking-client.js';

const RISK_ID_BY_CODE: Record<string, string> = {
  INFO: 'mock-risk-info',
  LOW: 'mock-risk-low',
  MEDIUM: 'mock-risk-medium',
  HIGH: 'mock-risk-high',
  CRITICAL: 'mock-risk-critical',
};

const ALERT_TYPE_ID_BY_CODE: Record<string, string> = {
  LOW_ATTENDANCE: 'mock-alert-attendance',
  LOW_PROGRESS: 'mock-alert-progress',
  MISSING_FOLLOW_UP: 'mock-alert-follow-up',
};

function buildAlerts(): GeneratedAlert[] {
  return [
    {
      id: 'mock-generated-alert-1',
      ficha_tracking_id: 'mock-tracking-1',
      alert_type_id: 'mock-alert-attendance',
      risk_level_id: 'mock-risk-high',
      source_event_id: 'mock-event-1',
      description: 'La asistencia de la ficha cayó al 70 %.',
      triggered_value: 70,
      threshold_value: 80,
      is_resolved: false,
      generated_at: '2026-07-08T09:00:00Z',
    },
    {
      id: 'mock-generated-alert-2',
      ficha_tracking_id: 'mock-tracking-1',
      alert_type_id: 'mock-alert-progress',
      risk_level_id: 'mock-risk-medium',
      source_event_id: 'mock-event-2',
      description: 'El avance curricular está por debajo del umbral.',
      triggered_value: 52,
      threshold_value: 60,
      is_resolved: true,
      resolved_by: 'mock-user',
      resolution_notes: 'Se ajustó el cronograma.',
      generated_at: '2026-06-20T09:00:00Z',
      resolved_at: '2026-06-25T15:00:00Z',
    },
    {
      id: 'mock-generated-alert-3',
      ficha_tracking_id: 'mock-tracking-1',
      alert_type_id: 'mock-alert-follow-up',
      risk_level_id: 'mock-risk-low',
      source_event_id: 'mock-event-3',
      description: 'No hay seguimiento registrado en los últimos 30 días.',
      is_resolved: false,
      generated_at: '2026-07-01T09:00:00Z',
    },
  ];
}

function buildPlans(): ImprovementPlan[] {
  return [
    {
      id: 'mock-plan-1',
      ficha_tracking_id: 'mock-tracking-1',
      generated_alert_id: 'mock-generated-alert-2',
      title: 'Plan de nivelación curricular',
      description: 'Reforzar las unidades atrasadas.',
      specific_actions: 'Sesiones de refuerzo semanales con el instructor.',
      due_date: '2026-08-30',
      status: 'IN_PROGRESS',
      created_by: 'mock-user',
      created_at: '2026-06-26T10:00:00Z',
    },
  ];
}

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('El cuerpo del mock debe ser un objeto.');
  return body as Record<string, unknown>;
}

function paginate<T>(items: T[], query?: HttpRequest['query']): CatalogPage<T> {
  const page = Number(query?.page ?? 1);
  const pageSize = Number(query?.page_size ?? 20);
  const start = (page - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    pagination: {
      page,
      page_size: pageSize,
      total_items: items.length,
      total_pages: Math.max(1, Math.ceil(items.length / pageSize)),
    } satisfies Pagination,
  };
}

/** Mock en memoria (modo standalone): alertas generadas y planes; delega todo lo demas al mock de seguimiento. */
export function createMockAlertsClient(): HttpClient {
  const base = createMockTrackingClient();
  const alerts = buildAlerts();
  const plans = buildPlans();

  return {
    async request<TResponse>(req: HttpRequest): Promise<TResponse> {
      const { method, path, query, body } = req;

      if (path === '/api/v1/generated-alerts' && method === 'GET') {
        const riskId = query?.risk_level ? RISK_ID_BY_CODE[String(query.risk_level)] : undefined;
        const typeId = query?.alert_type ? ALERT_TYPE_ID_BY_CODE[String(query.alert_type)] : undefined;
        const filtered = alerts.filter((item) =>
          (!query?.risk_level || item.risk_level_id === riskId)
          && (!query?.alert_type || item.alert_type_id === typeId)
          && (query?.is_resolved === undefined || item.is_resolved === query.is_resolved));
        const limit = Number(query?.limit ?? 50);
        const start = Number(query?.cursor ?? 0);
        const end = start + limit;
        return {
          data: filtered.slice(start, end).map((item) => ({ ...item })),
          pagination: { next_cursor: end < filtered.length ? String(end) : null, limit, has_more: end < filtered.length },
        } as TResponse;
      }

      const resolveMatch = path.match(/^\/api\/v1\/generated-alerts\/([^/]+)\/resolve$/);
      if (resolveMatch && method === 'PUT') {
        const id = decodeURIComponent(resolveMatch[1] ?? '');
        const alert = alerts.find((item) => item.id === id);
        if (!alert) throw new Error('Alerta no encontrada en el mock.');
        if (alert.is_resolved) throw new Error('La alerta ya está resuelta.');
        const payload = asRecord(body);
        alert.is_resolved = true;
        alert.resolution_notes = String(payload.resolution_notes ?? '');
        alert.resolved_by = 'mock-user';
        alert.resolved_at = new Date().toISOString();
        return { ...alert } as TResponse;
      }

      if (path === '/api/v1/improvement-plans' && method === 'GET') {
        const filtered = plans.filter((item) => !query?.status || item.status === query.status);
        return paginate(filtered.map((item) => ({ ...item })), query) as TResponse;
      }
      if (path === '/api/v1/improvement-plans' && method === 'POST') {
        const payload = asRecord(body) as unknown as ImprovementPlanCreate;
        const created: ImprovementPlan = {
          id: `mock-plan-${plans.length + 1}`,
          ficha_tracking_id: payload.ficha_tracking_id,
          generated_alert_id: payload.generated_alert_id ?? null,
          title: payload.title,
          description: payload.description,
          specific_actions: payload.specific_actions,
          due_date: payload.due_date,
          status: 'PENDING',
          created_by: 'mock-user',
          created_at: new Date().toISOString(),
        };
        plans.unshift(created);
        return { ...created } as TResponse;
      }

      return base.request<TResponse>(req);
    },
  };
}