import type { CatalogPage } from '../../contracts/catalog-types.js';
import type {
  FichaTracking,
  TrackingSession,
  TrackingSessionCreate,
} from '../../contracts/tracking-types.js';
import type { HttpClient } from '../../application/ports/monitoring-catalogs.js';
import type {
  FichaTrackingPort,
  TrackingListParams,
} from '../../application/ports/ficha-tracking.js';

const API_PREFIX = '/api/v1';

function buildPageQuery(params: Partial<TrackingListParams> = {}) {
  return {
    page: params.page ?? 1,
    page_size: params.pageSize ?? 20,
    ...(params.sort ? { sort: params.sort } : {}),
  };
}

export class FichaTrackingApiAdapter implements FichaTrackingPort {
  constructor(private readonly httpClient: HttpClient) {}

  listFichaTrackings(fichaId: string, params?: Partial<TrackingListParams>): Promise<CatalogPage<FichaTracking>> {
    return this.httpClient.request({
      method: 'GET',
      path: `${API_PREFIX}/ficha-trackings`,
      query: { ...buildPageQuery(params), ficha_id: fichaId },
    });
  }

  getFichaTracking(id: string): Promise<FichaTracking> {
    return this.httpClient.request({
      method: 'GET',
      path: `${API_PREFIX}/ficha-trackings/${encodeURIComponent(id)}`,
    });
  }

  listTrackingSessions(trackingId: string, params?: Partial<TrackingListParams>): Promise<CatalogPage<TrackingSession>> {
    return this.httpClient.request({
      method: 'GET',
      path: `${API_PREFIX}/ficha-trackings/${encodeURIComponent(trackingId)}/tracking-sessions`,
      query: buildPageQuery(params),
    });
  }

  createTrackingSession(trackingId: string, payload: TrackingSessionCreate): Promise<TrackingSession> {
    return this.httpClient.request({
      method: 'POST',
      path: `${API_PREFIX}/ficha-trackings/${encodeURIComponent(trackingId)}/tracking-sessions`,
      body: payload,
    });
  }

  getTrackingSession(trackingId: string, sessionId: string): Promise<TrackingSession> {
    return this.httpClient.request({
      method: 'GET',
      path: `${API_PREFIX}/ficha-trackings/${encodeURIComponent(trackingId)}/tracking-sessions/${encodeURIComponent(sessionId)}`,
    });
  }
}