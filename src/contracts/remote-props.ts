import type { HttpClient } from '../application/ports/monitoring-catalogs.js';
import type { KpiStatus, KpiType } from './catalog-types.js';

export interface FichaOption {
  id: string;
  label: string;
}

/** Capacidad RBAC que habilita registrar una sesion de seguimiento (POST .../tracking-sessions). */
export const MON_TRACKING_SESSION_CREATE = 'MON_TRACKING_SESSION_CREATE';

/** Contexto del usuario autenticado, entregado por el shell (este MFE nunca consulta IAM ni actors). */
export interface MonitoringUserContext {
  /**
   * instructor.id (actors-service) del usuario autenticado. Solo existe si el usuario es instructor.
   * Es el valor que se envia como instructor_id al registrar una sesion.
   */
  instructorId?: string;
  /** Capacidades RBAC del usuario, ej. MON_TRACKING_SESSION_CREATE. Sin capacidades = sin permiso. */
  capabilities?: readonly string[];
}

export interface MonitoringMfeProps {
  basePath?: string;
  /** Provided by the shell's frontend-platform facade. */
  httpClient?: HttpClient;
  /** Catalogs supplied by the shell for HU-006 KPI filters and registration. */
  catalogs?: {
    kpiTypes: KpiType[];
    kpiStatuses: KpiStatus[];
  };
  /** Usuario autenticado (identidad de instructor y capacidades) entregado por el shell. */
  user?: MonitoringUserContext;
  /**
   * Ficha elegida en el selector de academic-management-mfe.
   * El shell compone el selector y la entrega como prop (HU-MON-007); este MFE nunca consulta GET /fichas.
   */
  fichaId?: string;
  /** Texto a mostrar para la ficha entregada por el shell (ej. "2874412 - Analisis y Desarrollo de Software"). */
  fichaLabel?: string;
  /** Solo modo independiente (sin shell): fichas de ejemplo para el selector. */
  fichaOptions?: FichaOption[];
}

/**
 * True if the user has the capability, either plain ("CODE") or scoped ("CODE:SCOPE",
 * e.g. MON_TRACKING_SESSION_CREATE:OWN_FICHAS). Scope enforcement is the backend's job.
 */
export function hasCapability(capabilities: readonly string[] | undefined, code: string): boolean {
  return capabilities?.some((item) => item === code || item.startsWith(`${code}:`)) === true;
}

/** Capacidad RBAC para resolver una alerta generada (PUT /generated-alerts/{id}/resolve). */
export const MON_ALERT_RESOLVE = 'MON_ALERT_RESOLVE';

/** Capacidad RBAC para gestionar planes de mejoramiento (/improvement-plans). */
export const MON_IMPROVEMENT_PLAN_MANAGE = 'MON_IMPROVEMENT_PLAN_MANAGE';
