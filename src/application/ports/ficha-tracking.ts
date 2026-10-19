import type { CatalogPage } from '../../contracts/catalog-types.js';
import type {
  FichaTracking,
  TrackingSession,
  TrackingSessionCreate,
} from '../../contracts/tracking-types.js';

export interface TrackingListParams {
  page: number;
  pageSize: number;
  /** Formato del contrato: "<campo>:<asc|desc>", ej. session_date:desc */
  sort?: string;
}

export interface FichaTrackingPort {
  /** GET /ficha-trackings?ficha_id= */
  listFichaTrackings(fichaId: string, params?: Partial<TrackingListParams>): Promise<CatalogPage<FichaTracking>>;
  /** GET /ficha-trackings/{id} */
  getFichaTracking(id: string): Promise<FichaTracking>;
  /** GET /ficha-trackings/{id}/tracking-sessions */
  listTrackingSessions(trackingId: string, params?: Partial<TrackingListParams>): Promise<CatalogPage<TrackingSession>>;
  /** POST /ficha-trackings/{id}/tracking-sessions */
  createTrackingSession(trackingId: string, payload: TrackingSessionCreate): Promise<TrackingSession>;
  /** GET /ficha-trackings/{id}/tracking-sessions/{session_id} */
  getTrackingSession(trackingId: string, sessionId: string): Promise<TrackingSession>;
}