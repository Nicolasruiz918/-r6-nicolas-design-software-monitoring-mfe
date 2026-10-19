import type { components } from './generated/monitoring.js';

export type FichaTracking = components['schemas']['FichaTracking'];
export type TrackingSession = components['schemas']['TrackingSession'];
export type TrackingSessionCreate = components['schemas']['TrackingSessionCreate'];

/** session_type es un string cerrado: nunca se importa el enum nativo de Postgres. */
export type SessionType = TrackingSession['session_type'];

/*
 * NOTA DE CONTRATO: ficha_tracking es de SOLO LECTURA en monitoring.yaml
 * (lo recalcula el alert-worker). No existe POST /ficha-trackings, por eso este MFE
 * solo registra sesiones: POST /ficha-trackings/{id}/tracking-sessions.
 */