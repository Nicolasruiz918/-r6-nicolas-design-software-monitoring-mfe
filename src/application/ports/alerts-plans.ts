import type { CatalogPage, CursorPagination } from '../../contracts/catalog-types.js';
import type {
  GeneratedAlert,
  GeneratedAlertResolve,
  ImprovementPlan,
  ImprovementPlanCreate,
  PlanStatus,
} from '../../contracts/alerts-plans-types.js';

export interface AlertListParams {
  cursor?: string | undefined;
  limit?: number | undefined;
  alertType?: string | undefined;
  riskLevel?: string | undefined;
  isResolved?: boolean | undefined;
}

export interface PlanListParams {
  page?: number | undefined;
  pageSize?: number | undefined;
  status?: PlanStatus | undefined;
}

export interface GeneratedAlertPage {
  data: GeneratedAlert[];
  pagination: CursorPagination;
}

export interface AlertsPlansPort {
  /** GET /generated-alerts (paginacion por cursor) */
  listGeneratedAlerts(params?: AlertListParams): Promise<GeneratedAlertPage>;
  /** PUT /generated-alerts/{id}/resolve */
  resolveGeneratedAlert(id: string, payload: GeneratedAlertResolve): Promise<GeneratedAlert>;
  /** GET /improvement-plans */
  listImprovementPlans(params?: PlanListParams): Promise<CatalogPage<ImprovementPlan>>;
  /** POST /improvement-plans */
  createImprovementPlan(payload: ImprovementPlanCreate): Promise<ImprovementPlan>;
}