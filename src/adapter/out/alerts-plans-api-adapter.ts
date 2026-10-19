import type { CatalogPage } from '../../contracts/catalog-types.js';
import type {
  GeneratedAlert,
  GeneratedAlertResolve,
  ImprovementPlan,
  ImprovementPlanCreate,
} from '../../contracts/alerts-plans-types.js';
import type { HttpClient } from '../../application/ports/monitoring-catalogs.js';
import type {
  AlertListParams,
  AlertsPlansPort,
  GeneratedAlertPage,
  PlanListParams,
} from '../../application/ports/alerts-plans.js';

const API_PREFIX = '/api/v1';

export class AlertsPlansApiAdapter implements AlertsPlansPort {
  constructor(private readonly httpClient: HttpClient) {}

  listGeneratedAlerts(params: AlertListParams = {}): Promise<GeneratedAlertPage> {
    return this.httpClient.request({
      method: 'GET',
      path: `${API_PREFIX}/generated-alerts`,
      query: {
        cursor: params.cursor,
        limit: params.limit,
        alert_type: params.alertType,
        risk_level: params.riskLevel,
        is_resolved: params.isResolved,
      },
    });
  }

  resolveGeneratedAlert(id: string, payload: GeneratedAlertResolve): Promise<GeneratedAlert> {
    return this.httpClient.request({
      method: 'PUT',
      path: `${API_PREFIX}/generated-alerts/${encodeURIComponent(id)}/resolve`,
      body: payload,
    });
  }

  listImprovementPlans(params: PlanListParams = {}): Promise<CatalogPage<ImprovementPlan>> {
    return this.httpClient.request({
      method: 'GET',
      path: `${API_PREFIX}/improvement-plans`,
      query: {
        page: params.page ?? 1,
        page_size: params.pageSize ?? 20,
        status: params.status,
      },
    });
  }

  createImprovementPlan(payload: ImprovementPlanCreate): Promise<ImprovementPlan> {
    return this.httpClient.request({
      method: 'POST',
      path: `${API_PREFIX}/improvement-plans`,
      body: payload,
    });
  }
}