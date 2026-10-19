import type { CatalogPage, Pagination } from '../../contracts/catalog-types.js';
import type { FichaOption } from '../../contracts/remote-props.js';
import type {
  FichaTracking,
  SessionType,
  TrackingSession,
  TrackingSessionCreate,
} from '../../contracts/tracking-types.js';
import type { HttpClient, HttpRequest } from '../../application/ports/monitoring-catalogs.js';
import { createMockMonitoringClient } from './mock-monitoring-client.js';

const PREFIX = '/api/v1/ficha-trackings';

export const MOCK_FICHA_ID = 'ficha-demo-001';

export const MOCK_FICHA_OPTIONS: FichaOption[] = [
  { id: MOCK_FICHA_ID, label: '2874412 - Análisis y Desarrollo de Software' },
  { id: 'ficha-demo-002', label: '2758543 - Gestión Empresarial (sin seguimientos)' },
];

const SESSION_TYPE_CYCLE: SessionType[] = ['ACADEMIC', 'PROJECT', 'WELLNESS', 'ACADEMIC', 'PRODUCTIVE_STAGE'];

function shiftDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** 27 sesiones para poder probar la paginacion (mas reciente primero por id). */
function buildSessions(): TrackingSession[] {
  return Array.from({ length: 27 }, (_, index) => {
    const attendance = 17 + (index % 4);
    const total = 20;
    const date = shiftDate('2026-07-10', index * 3);
    return {
      id: `mock-session-${index + 1}`,
      ficha_tracking_id: 'mock-tracking-1',
      instructor_id: 'mock-instructor-1',
      session_date: date,
      session_type: SESSION_TYPE_CYCLE[index % SESSION_TYPE_CYCLE.length] as SessionType,
      attendance_count: attendance,
      total_learners: total,
      attendance_percentage: Math.round((attendance / total) * 10000) / 100,
      curriculum_progress_percentage: Math.max(5, 65 - index * 2),
      observations: index % 3 === 0 ? 'Se detectan aprendices en riesgo de deserción.' : 'Avance según lo planeado.',
      requires_follow_up: index % 3 === 0,
      created_at: `${date}T10:00:00Z`,
    };
  });
}

function buildTrackings(): FichaTracking[] {
  return [
    {
      id: 'mock-tracking-1',
      ficha_id: MOCK_FICHA_ID,
      assigned_instructor_id: 'mock-instructor-1',
      overall_status_id: 'mock-status-at-risk',
      active_alert_count: 2,
      last_tracking_date: '2026-07-10',
      next_tracking_date: '2026-08-10',
      created_at: '2026-03-01T08:00:00Z',
    },
    {
      id: 'mock-tracking-2',
      ficha_id: 'ficha-demo-002',
      assigned_instructor_id: 'mock-instructor-1',
      overall_status_id: 'mock-status-on-track',
      active_alert_count: 0,
      last_tracking_date: null,
      next_tracking_date: null,
      created_at: '2026-03-05T08:00:00Z',
    },
  ];
}

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('El cuerpo del mock debe ser un objeto.');
  }
  return body as Record<string, unknown>;
}

function paginate<T>(items: T[], query?: HttpRequest['query']): CatalogPage<T> {
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

/** Mock en memoria para modo standalone: sirve ficha-trackings y delega catalogos al mock existente. */
export function createMockTrackingClient(): HttpClient {
  const base = createMockMonitoringClient();
  const trackings = buildTrackings();
  const sessions = buildSessions();
  let statusesResolved = false;

  /** Alinea los overall_status_id del mock con los ids reales del mock de catalogos (por code). */
  async function resolveStatuses() {
    if (statusesResolved) return;
    statusesResolved = true;
    try {
      const response = await base.request<unknown>({ method: 'GET', path: '/api/v1/kpi-statuses' });
      const list = Array.isArray(response) ? response : (response as { data?: unknown[] }).data ?? [];
      const byCode = new Map<string, string>();
      for (const entry of list as Array<{ id: string; code: string }>) byCode.set(entry.code, entry.id);
      const first = trackings[0];
      const second = trackings[1];
      const atRisk = byCode.get('AT_RISK');
      const onTrack = byCode.get('ON_TRACK');
      if (first && atRisk) first.overall_status_id = atRisk;
      if (second && onTrack) second.overall_status_id = onTrack;
    } catch {
      // Sin catalogos: se conservan los ids de ejemplo.
    }
  }

  return {
    async request<TResponse>(req: HttpRequest): Promise<TResponse> {
      const { method, path, query, body } = req;

      if (path === PREFIX && method === 'GET') {
        await resolveStatuses();
        const fichaId = query?.ficha_id;
        const filtered = trackings.filter((item) => !fichaId || item.ficha_id === String(fichaId));
        return paginate(filtered.map((item) => ({ ...item })), query) as TResponse;
      }

      const match = path.match(/^\/api\/v1\/ficha-trackings\/([^/]+)(?:\/tracking-sessions(?:\/([^/]+))?)?$/);
      if (match) {
        await resolveStatuses();
        const trackingId = match[1] ? decodeURIComponent(match[1]) : '';
        const sessionId = match[2] ? decodeURIComponent(match[2]) : null;
        const isSessionsPath = path.includes('/tracking-sessions');
        const tracking = trackings.find((item) => item.id === trackingId);
        if (!tracking) throw new Error('Seguimiento de ficha no encontrado en el mock.');

        if (!isSessionsPath && method === 'GET') return { ...tracking } as TResponse;

        if (isSessionsPath && !sessionId && method === 'GET') {
          const direction = String(query?.sort ?? '').endsWith(':desc') ? -1 : 1;
          const own = sessions
            .filter((item) => item.ficha_tracking_id === trackingId)
            .sort((a, b) => direction * a.session_date.localeCompare(b.session_date));
          return paginate(own.map((item) => ({ ...item })), query) as TResponse;
        }

        if (isSessionsPath && !sessionId && method === 'POST') {
          const payload = asRecord(body) as unknown as TrackingSessionCreate;
          const attendance = payload.attendance_count;
          const total = payload.total_learners;
          const created: TrackingSession = {
            id: `mock-session-${sessions.length + 1}`,
            ficha_tracking_id: trackingId,
            instructor_id: payload.instructor_id,
            session_date: payload.session_date,
            session_type: payload.session_type,
            attendance_count: attendance ?? null,
            total_learners: total ?? null,
            attendance_percentage:
              attendance !== undefined && total !== undefined && total > 0
                ? Math.round((attendance / total) * 10000) / 100
                : null,
            curriculum_progress_percentage: payload.curriculum_progress_percentage ?? null,
            observations: payload.observations ?? null,
            requires_follow_up: payload.requires_follow_up ?? false,
            created_at: new Date().toISOString(),
          };
          sessions.push(created);
          if (!tracking.last_tracking_date || payload.session_date > tracking.last_tracking_date) {
            tracking.last_tracking_date = payload.session_date;
          }
          return { ...created } as TResponse;
        }

        if (isSessionsPath && sessionId && method === 'GET') {
          const found = sessions.find((item) => item.id === sessionId && item.ficha_tracking_id === trackingId);
          if (!found) throw new Error('Sesión de seguimiento no encontrada en el mock.');
          return { ...found } as TResponse;
        }
      }

      return base.request<TResponse>(req);
    },
  };
}