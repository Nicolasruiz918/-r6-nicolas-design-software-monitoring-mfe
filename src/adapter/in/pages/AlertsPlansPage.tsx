import { useMemo, useState } from 'react';

import { useAlertTypes } from '../../../application/hooks/useAlertTypes.js';
import { useGeneratedAlerts, type AlertFilters } from '../../../application/hooks/useGeneratedAlerts.js';
import { useImprovementPlans } from '../../../application/hooks/useImprovementPlans.js';
import { useRiskLevels } from '../../../application/hooks/useRiskLevels.js';
import type { AlertsPlansPort } from '../../../application/ports/alerts-plans.js';
import type { MonitoringCatalogPort } from '../../../application/ports/monitoring-catalogs.js';
import type {
  GeneratedAlert,
  GeneratedAlertResolve,
  ImprovementPlanCreate,
  PlanStatus,
} from '../../../contracts/alerts-plans-types.js';
import {
  MON_ALERT_RESOLVE,
  MON_IMPROVEMENT_PLAN_MANAGE,
  hasCapability,
  type MonitoringUserContext,
} from '../../../contracts/remote-props.js';
import { LoadingState, PaginationControls } from '../components/CatalogControls.js';
import {
  ImprovementPlanForm,
  PLAN_STATUSES,
  PLAN_STATUS_LABELS,
  ResolveAlertForm,
} from '../components/AlertsForms.js';
import { formatShortDate } from '../components/trackingFormat.js';
import styles from '../../../App.module.css';

type Tab = 'alerts' | 'plans';
type Tone = 'success' | 'warning' | 'danger' | 'neutral';
type ResolvedFilter = 'all' | 'pending' | 'resolved';

const TONE_CLASS: Record<Tone, string> = {
  success: styles.trkSuccess,
  warning: styles.trkWarning,
  danger: styles.trkDanger,
  neutral: styles.trkNeutral,
};

function Badge({ tone, icon, children }: { tone: Tone; icon: string; children: string }) {
  return (
    <span className={`${styles.trkBadge} ${TONE_CLASS[tone]}`}>
      <span aria-hidden="true">{icon}</span>
      {children}
    </span>
  );
}

/** Severidad: siempre icono + texto, la etiqueta viene del catalogo risk-levels (no lista propia). */
function riskView(code: string | undefined): { tone: Tone; icon: string } {
  if (code === 'CRITICAL' || code === 'HIGH') return { tone: 'danger', icon: '▲' };
  if (code === 'MEDIUM') return { tone: 'warning', icon: '▲' };
  if (code === 'LOW') return { tone: 'success', icon: '✓' };
  return { tone: 'neutral', icon: '●' };
}

function planView(status: PlanStatus): { tone: Tone; icon: string } {
  if (status === 'COMPLETED') return { tone: 'success', icon: '✓' };
  if (status === 'IN_PROGRESS') return { tone: 'warning', icon: '●' };
  return { tone: 'neutral', icon: status === 'CANCELLED' ? '✕' : '●' };
}

function SectionError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className={styles.trkFormError} role="alert">
      <strong>{title}</strong> <span>{message}</span>
      {onRetry ? <button className={styles.secondaryButton} type="button" onClick={onRetry}>Reintentar</button> : null}
    </div>
  );
}

function buildFilters(riskLevel: string, alertType: string, state: ResolvedFilter): AlertFilters {
  return {
    ...(riskLevel ? { riskLevel } : {}),
    ...(alertType ? { alertType } : {}),
    ...(state === 'all' ? {} : { isResolved: state === 'resolved' }),
  };
}

export function AlertsPlansPage({
  alertsApi,
  catalogApi,
  user,
}: {
  alertsApi: AlertsPlansPort;
  catalogApi: MonitoringCatalogPort;
  /** Usuario autenticado entregado por el shell (capacidades). */
  user?: MonitoringUserContext;
}) {
  const [tab, setTab] = useState<Tab>('alerts');
  const [riskFilter, setRiskFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [stateFilter, setStateFilter] = useState<ResolvedFilter>('all');
  const [resolveTarget, setResolveTarget] = useState<GeneratedAlert | null>(null);
  const [planSource, setPlanSource] = useState<GeneratedAlert | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const alerts = useGeneratedAlerts(alertsApi);
  const plans = useImprovementPlans(alertsApi, tab === 'plans');
  const riskLevels = useRiskLevels(catalogApi);
  const alertTypes = useAlertTypes(catalogApi);

  const riskById = useMemo(() => new Map(riskLevels.data.map((risk) => [risk.id, risk])), [riskLevels.data]);
  const typeById = useMemo(() => new Map(alertTypes.data.map((type) => [type.id, type])), [alertTypes.data]);

  // Permisos: sin capacidad (o sin user) no se puede mutar (falla cerrado). La consulta la valida el backend (403).
  const canResolve = hasCapability(user?.capabilities, MON_ALERT_RESOLVE);
  const canManagePlans = hasCapability(user?.capabilities, MON_IMPROVEMENT_PLAN_MANAGE);

  function applyFilters(risk: string, type: string, state: ResolvedFilter) {
    setRiskFilter(risk);
    setTypeFilter(type);
    setStateFilter(state);
    void alerts.load(buildFilters(risk, type, state));
  }

  async function saveResolve(payload: GeneratedAlertResolve) {
    if (!resolveTarget) return;
    await alerts.resolve(resolveTarget.id, payload);
    setToast('Alerta resuelta.');
    setResolveTarget(null);
  }

  async function savePlan(payload: ImprovementPlanCreate) {
    await plans.create(payload);
    setToast('Plan de mejoramiento creado.');
    setPlanSource(null);
  }

  const showAlertsSpinner = alerts.isLoading && alerts.data.length === 0;

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Monitoring · Instructor / Coordinación</p>
          <h1>Alertas y planes de mejoramiento</h1>
          <p className={styles.subtitle}>Resuelve las alertas generadas y gestiona los planes para cerrar el ciclo de seguimiento.</p>
        </div>
      </header>

      <div className={styles.catalogPanel}>
        <div className={styles.tabs} role="tablist" aria-label="Alertas y planes">
          <button className={`${styles.tab} ${tab === 'alerts' ? styles.activeTab : ''}`} type="button" role="tab" aria-selected={tab === 'alerts'} onClick={() => setTab('alerts')}>
            Alertas generadas
          </button>
          <button className={`${styles.tab} ${tab === 'plans' ? styles.activeTab : ''}`} type="button" role="tab" aria-selected={tab === 'plans'} onClick={() => setTab('plans')}>
            Planes de mejoramiento
          </button>
        </div>

        {toast ? (
          <div className={styles.feedback} role="status" aria-live="polite">
            {toast}
            <button type="button" aria-label="Cerrar mensaje" onClick={() => setToast(null)}>×</button>
          </div>
        ) : null}

        <div className={styles.panelBody} role="tabpanel">
          {tab === 'alerts' && !canResolve ? (
            <p id="alerts-no-resolve" className={styles.trkNotice} role="note">No tienes permiso para resolver alertas.</p>
          ) : null}
          {tab === 'alerts' && canResolve && !canManagePlans ? (
            <p className={styles.trkNotice} role="note">No tienes permiso para gestionar planes de mejoramiento.</p>
          ) : null}

          {tab === 'alerts' ? (
            <>
              <div className={styles.trkFilters}>
                <label className={styles.field}>
                  Nivel de riesgo
                  <select value={riskFilter} onChange={(event) => applyFilters(event.target.value, typeFilter, stateFilter)}>
                    <option value="">Todos</option>
                    {riskLevels.data.map((risk) => <option key={risk.id} value={risk.code}>{risk.label}</option>)}
                  </select>
                </label>
                <label className={styles.field}>
                  Tipo de alerta
                  <select value={typeFilter} onChange={(event) => applyFilters(riskFilter, event.target.value, stateFilter)}>
                    <option value="">Todos</option>
                    {alertTypes.data.map((type) => <option key={type.id} value={type.code}>{type.name}</option>)}
                  </select>
                </label>
                <label className={styles.field}>
                  Estado
                  <select value={stateFilter} onChange={(event) => applyFilters(riskFilter, typeFilter, event.target.value as ResolvedFilter)}>
                    <option value="all">Todas</option>
                    <option value="pending">Pendientes</option>
                    <option value="resolved">Resueltas</option>
                  </select>
                </label>
              </div>

              {showAlertsSpinner ? <LoadingState label="alertas" /> : null}
              {alerts.error ? <SectionError title="No se pudieron cargar las alertas." message={alerts.error} onRetry={() => void alerts.load()} /> : null}
              {!alerts.isLoading && !alerts.error && alerts.data.length === 0 ? (
                <p className={styles.trkEmpty}>No hay alertas para los filtros seleccionados.</p>
              ) : null}

              {alerts.data.length > 0 ? (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <caption className={styles.srOnly}>Alertas generadas</caption>
                    <thead>
                      <tr>
                        <th scope="col">Generada</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">Riesgo</th>
                        <th scope="col">Descripción</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.data.map((alert) => {
                        const risk = riskById.get(alert.risk_level_id);
                        const view = riskView(risk?.code);
                        return (
                          <tr key={alert.id}>
                            <td data-label="Generada">{formatShortDate(alert.generated_at)}</td>
                            <td data-label="Tipo">{typeById.get(alert.alert_type_id)?.name ?? alert.alert_type_id}</td>
                            <td data-label="Riesgo"><Badge tone={view.tone} icon={view.icon}>{risk?.label ?? 'Sin clasificar'}</Badge></td>
                            <td data-label="Descripción">{alert.description}</td>
                            <td data-label="Estado">
                              {alert.is_resolved ? <Badge tone="success" icon="✓">Resuelta</Badge> : <Badge tone="warning" icon="▲">Pendiente</Badge>}
                            </td>
                            <td data-label="Acciones">
                              {alert.is_resolved ? (
                                <button
                                  className={styles.linkButton}
                                  type="button"
                                  disabled={!canManagePlans}
                                  onClick={() => { plans.resetMutationError(); setPlanSource(alert); }}
                                >
                                  Crear plan
                                </button>
                              ) : (
                                <button
                                  className={styles.linkButton}
                                  type="button"
                                  disabled={!canResolve}
                                  aria-describedby={canResolve ? undefined : 'alerts-no-resolve'}
                                  onClick={() => { alerts.resetResolveError(); setResolveTarget(alert); }}
                                >
                                  Marcar como atendida
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {alerts.hasMore ? (
                <div className={styles.pagination}>
                  <span>Hay más alertas disponibles.</span>
                  <button className={styles.secondaryButton} type="button" onClick={() => void alerts.loadMore()} disabled={alerts.isLoading}>
                    {alerts.isLoading ? 'Cargando…' : 'Cargar más'}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className={styles.trkFilters}>
                <label className={styles.field}>
                  Estado del plan
                  <select value={plans.status} onChange={(event) => plans.changeStatus(event.target.value as PlanStatus | '')}>
                    <option value="">Todos</option>
                    {PLAN_STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>

              {plans.isLoading ? <LoadingState label="planes de mejoramiento" /> : null}
              {!plans.isLoading && plans.error ? <SectionError title="No se pudieron cargar los planes." message={plans.error} onRetry={plans.reload} /> : null}
              {!plans.isLoading && !plans.error && plans.data.length === 0 ? (
                <p className={styles.trkEmpty}>No hay planes de mejoramiento para el filtro seleccionado.</p>
              ) : null}

              {!plans.isLoading && !plans.error && plans.data.length > 0 ? (
                <>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <caption className={styles.srOnly}>Planes de mejoramiento</caption>
                      <thead>
                        <tr>
                          <th scope="col">Título</th>
                          <th scope="col">Acciones específicas</th>
                          <th scope="col">Fecha límite</th>
                          <th scope="col">Estado</th>
                          <th scope="col">Creado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plans.data.map((plan) => {
                          const view = planView(plan.status);
                          return (
                            <tr key={plan.id}>
                              <td data-label="Título"><strong>{plan.title}</strong></td>
                              <td data-label="Acciones específicas">{plan.specific_actions}</td>
                              <td data-label="Fecha límite">{formatShortDate(plan.due_date)}</td>
                              <td data-label="Estado"><Badge tone={view.tone} icon={view.icon}>{PLAN_STATUS_LABELS[plan.status] ?? plan.status}</Badge></td>
                              <td data-label="Creado">{formatShortDate(plan.created_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls pagination={plans.pagination} onPageChange={plans.setPage} />
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {resolveTarget && canResolve ? (
        <ResolveAlertForm
          alert={resolveTarget}
          isSaving={alerts.isResolving}
          error={alerts.resolveError}
          onSubmit={saveResolve}
          onClose={() => setResolveTarget(null)}
        />
      ) : null}
      {planSource && canManagePlans ? (
        <ImprovementPlanForm
          alert={planSource}
          isSaving={plans.isMutating}
          error={plans.mutationError}
          onSubmit={savePlan}
          onClose={() => setPlanSource(null)}
        />
      ) : null}
    </section>
  );
}