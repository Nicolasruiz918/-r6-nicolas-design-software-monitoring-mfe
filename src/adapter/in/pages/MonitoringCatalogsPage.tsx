import { useMemo, useState } from 'react';

import type {
  AlertType,
  AlertTypeCreate,
  AlertTypeUpdate,
  KpiStatus,
  KpiType,
  KpiTypeCreate,
  KpiTypeUpdate,
  RiskLevel,
} from '../../../contracts/catalog-types.js';
import type { MonitoringCatalogPort } from '../../../application/ports/monitoring-catalogs.js';
import { useAlertTypes } from '../../../application/hooks/useAlertTypes.js';
import { useKpiStatuses } from '../../../application/hooks/useKpiStatuses.js';
import { useKpiTypes } from '../../../application/hooks/useKpiTypes.js';
import { useRiskLevels } from '../../../application/hooks/useRiskLevels.js';
import {
  AlertTypeForm,
  KpiTypeForm,
} from '../components/CatalogForms.js';
import {
  BooleanBadge,
  EmptyState,
  ErrorState,
  LoadingState,
  PaginationControls,
} from '../components/CatalogControls.js';
import styles from '../../../App.module.css';

type CatalogTab = 'kpi-types' | 'kpi-statuses' | 'risk-levels' | 'alert-types';
type ModalState = { resource: 'kpi' | 'alert'; item: KpiType | AlertType | null };

const TAB_LABELS: Array<{ id: CatalogTab; label: string }> = [
  { id: 'kpi-types', label: 'Tipos de KPI' },
  { id: 'kpi-statuses', label: 'Estados de KPI' },
  { id: 'risk-levels', label: 'Niveles de riesgo' },
  { id: 'alert-types', label: 'Tipos de alerta' },
];

const UNIT_LABELS: Record<string, string> = {
  PERCENTAGE: 'Porcentaje',
  COUNT: 'Cantidad',
  HOURS: 'Horas',
  DAYS: 'Días',
};

function formatNullable(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function ReadonlyCatalogNotice() {
  return (
    <p className={styles.readonlyNotice}>
      Este catálogo es cerrado y solo se consulta desde Monitoring. No tiene acciones de creación ni edición.
    </p>
  );
}

function TabNavigation({ activeTab, onChange }: { activeTab: CatalogTab; onChange: (tab: CatalogTab) => void }) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Catálogos de monitoreo">
      {TAB_LABELS.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`${tab.id}-panel`}
          id={`${tab.id}-tab`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function CatalogSectionHeader({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <header className={styles.catalogSectionHeader}>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button className={styles.primaryButton} type="button" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </header>
  );
}

function KpiTypesTable({
  data,
  onEdit,
}: {
  data: KpiType[];
  onEdit: (item: KpiType) => void;
}) {
  if (data.length === 0) return <EmptyState label="tipos de KPI" />;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>Tipos de KPI configurables</caption>
        <thead><tr><th scope="col">Código</th><th scope="col">Nombre</th><th scope="col">Descripción</th><th scope="col">Unidad</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <td data-label="Código"><strong>{item.code}</strong></td>
              <td data-label="Nombre">{item.name}</td>
              <td data-label="Descripción">{formatNullable(item.description)}</td>
              <td data-label="Unidad">{UNIT_LABELS[item.unit] ?? item.unit}</td>
              <td data-label="Estado"><BooleanBadge value={item.is_active} /></td>
              <td data-label="Acciones"><button className={styles.linkButton} type="button" onClick={() => onEdit(item)}>Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertTypesTable({
  data,
  onEdit,
}: {
  data: AlertType[];
  onEdit: (item: AlertType) => void;
}) {
  if (data.length === 0) return <EmptyState label="tipos de alerta" />;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>Tipos de alerta configurables</caption>
        <thead><tr><th scope="col">Código</th><th scope="col">Nombre</th><th scope="col">Descripción</th><th scope="col">Umbral</th><th scope="col">Unidad</th><th scope="col">Afecta estado de ficha</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <td data-label="Código"><strong>{item.code}</strong></td>
              <td data-label="Nombre">{item.name}</td>
              <td data-label="Descripción">{formatNullable(item.description)}</td>
              <td data-label="Umbral">{formatNullable(item.default_threshold)}</td>
              <td data-label="Unidad">{item.threshold_unit ? UNIT_LABELS[item.threshold_unit] ?? item.threshold_unit : '—'}</td>
              <td data-label="Afecta estado de ficha">{item.affects_ficha_status ? 'Sí' : 'No'}</td>
              <td data-label="Estado"><BooleanBadge value={item.is_active} /></td>
              <td data-label="Acciones"><button className={styles.linkButton} type="button" onClick={() => onEdit(item)}>Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskLevelsTable({ data }: { data: RiskLevel[] }) {
  if (data.length === 0) return <EmptyState label="niveles de riesgo" />;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>Niveles de riesgo de solo lectura</caption>
        <thead><tr><th scope="col">Prioridad</th><th scope="col">Código</th><th scope="col">Etiqueta</th><th scope="col">Color</th></tr></thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id}>
              <td data-label="Prioridad">{item.priority_order}</td>
              <td data-label="Código"><strong>{item.code}</strong></td>
              <td data-label="Etiqueta">{item.label}</td>
              <td data-label="Color"><span className={styles.colorSwatch} style={{ backgroundColor: item.color_hex }} aria-hidden="true" />{item.color_hex}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KpiStatusesTable({ data, riskLevels }: { data: KpiStatus[]; riskLevels: RiskLevel[] }) {
  const riskById = useMemo(() => new Map(riskLevels.map((level) => [level.id, level])), [riskLevels]);
  if (data.length === 0) return <EmptyState label="estados de KPI" />;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>Estados de KPI de solo lectura</caption>
        <thead><tr><th scope="col">Código</th><th scope="col">Descripción</th><th scope="col">Nivel de riesgo</th></tr></thead>
        <tbody>
          {data.map((item) => {
            const risk = riskById.get(item.risk_level_id);
            return (
              <tr key={item.id}>
                <td data-label="Código"><strong>{item.code}</strong></td>
                <td data-label="Descripción">{formatNullable(item.description)}</td>
                <td data-label="Nivel de riesgo">{risk ? `${risk.label} (${risk.code})` : item.risk_level_id}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MonitoringCatalogsPage({ api }: { api: MonitoringCatalogPort }) {
  const [activeTab, setActiveTab] = useState<CatalogTab>('kpi-types');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const kpiTypes = useKpiTypes(api);
  const alertTypes = useAlertTypes(api);
  const riskLevels = useRiskLevels(api);
  const kpiStatuses = useKpiStatuses(api);

  async function saveKpi(payload: KpiTypeCreate | KpiTypeUpdate) {
    if (modal?.item && 'id' in modal.item) {
      await kpiTypes.update(modal.item.id, payload as KpiTypeUpdate);
      setFeedback('Tipo de KPI actualizado correctamente.');
    } else {
      await kpiTypes.create(payload as KpiTypeCreate);
      setFeedback('Tipo de KPI creado correctamente.');
    }
    setModal(null);
  }

  async function saveAlert(payload: AlertTypeCreate | AlertTypeUpdate) {
    if (modal?.item && 'id' in modal.item) {
      await alertTypes.update(modal.item.id, payload as AlertTypeUpdate);
      setFeedback('Tipo de alerta actualizado correctamente.');
    } else {
      await alertTypes.create(payload as AlertTypeCreate);
      setFeedback('Tipo de alerta creado correctamente.');
    }
    setModal(null);
  }

  const activeError = activeTab === 'kpi-types' ? kpiTypes.error
    : activeTab === 'alert-types' ? alertTypes.error
      : activeTab === 'risk-levels' ? riskLevels.error : kpiStatuses.error;
  const activeLoading = activeTab === 'kpi-types' ? kpiTypes.isLoading
    : activeTab === 'alert-types' ? alertTypes.isLoading
      : activeTab === 'risk-levels' ? riskLevels.isLoading : kpiStatuses.isLoading;

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Monitoring · Administración</p>
          <h1>Parametrización — Monitoreo</h1>
          <p className={styles.subtitle}>Tipos de KPI, estados, niveles de riesgo y tipos de alerta que usan indicadores, alertas y seguimiento.</p>
        </div>
      </header>

      <div className={styles.catalogPanel}>
        <TabNavigation activeTab={activeTab} onChange={setActiveTab} />
        {feedback ? <div className={styles.feedback} role="status" aria-live="polite">{feedback}<button type="button" aria-label="Cerrar mensaje" onClick={() => setFeedback(null)}>×</button></div> : null}
        <div className={styles.panelBody} role="tabpanel" id={`${activeTab}-panel`} aria-labelledby={`${activeTab}-tab`}>
          {activeLoading ? <LoadingState label={TAB_LABELS.find((tab) => tab.id === activeTab)?.label.toLowerCase() ?? 'datos'} /> : null}
          {!activeLoading && activeError ? (
            <ErrorState
              message={activeError}
              onRetry={() => {
                if (activeTab === 'kpi-types') void kpiTypes.load();
                if (activeTab === 'alert-types') void alertTypes.load();
                if (activeTab === 'risk-levels') void riskLevels.reload();
                if (activeTab === 'kpi-statuses') void kpiStatuses.reload();
              }}
            />
          ) : null}
          {!activeLoading && !activeError && activeTab === 'kpi-types' ? (
            <>
              <CatalogSectionHeader
                title="Tipos de KPI"
                description="Definen qué mide cada indicador; los usa el panel de indicadores y el seguimiento de ficha."
                actionLabel="Nuevo tipo de KPI"
                onAction={() => setModal({ resource: 'kpi', item: null })}
              />
              <KpiTypesTable data={kpiTypes.data} onEdit={(item) => setModal({ resource: 'kpi', item })} />
              <PaginationControls pagination={kpiTypes.pagination} onPageChange={(page) => void kpiTypes.load({ page })} />
            </>
          ) : null}
          {!activeLoading && !activeError && activeTab === 'alert-types' ? (
            <>
              <CatalogSectionHeader
                title="Tipos de alerta"
                description="Reglas que disparan alertas; su umbral por defecto puede afectar el estado de la ficha."
                actionLabel="Nuevo tipo de alerta"
                onAction={() => setModal({ resource: 'alert', item: null })}
              />
              <AlertTypesTable data={alertTypes.data} onEdit={(item) => setModal({ resource: 'alert', item })} />
              <PaginationControls pagination={alertTypes.pagination} onPageChange={(page) => void alertTypes.load({ page })} />
            </>
          ) : null}
          {!activeLoading && !activeError && activeTab === 'risk-levels' ? (
            <>
              <CatalogSectionHeader
                title="Niveles de riesgo"
                description="Prioridad y color con que se resaltan estados y alertas en toda la app."
              />
              <ReadonlyCatalogNotice />
              <RiskLevelsTable data={riskLevels.data} />
            </>
          ) : null}
          {!activeLoading && !activeError && activeTab === 'kpi-statuses' ? (
            <>
              <CatalogSectionHeader
                title="Estados de KPI"
                description="Clasifican cada medición y se asocian a un nivel de riesgo."
              />
              <ReadonlyCatalogNotice />
              <KpiStatusesTable data={kpiStatuses.data} riskLevels={riskLevels.data} />
            </>
          ) : null}
        </div>
      </div>

      {modal?.resource === 'kpi' ? (
        <KpiTypeForm
          item={modal.item && 'unit' in modal.item ? modal.item : null}
          isSaving={kpiTypes.isMutating}
          error={kpiTypes.error}
          onSubmit={saveKpi}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal?.resource === 'alert' ? (
        <AlertTypeForm
          item={modal.item && 'affects_ficha_status' in modal.item ? modal.item : null}
          isSaving={alertTypes.isMutating}
          error={alertTypes.error}
          onSubmit={saveAlert}
          onClose={() => setModal(null)}
        />
      ) : null}
    </section>
  );
}
