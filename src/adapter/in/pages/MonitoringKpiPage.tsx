import { useMemo, useState, type FormEvent } from 'react';
import styles from './MonitoringKpiPage.module.css';
import type { MonitoringMfeProps } from '../../../contracts/remote-props.js';
import type { KpiSummaryReportEntry, KpiTrackingCreate } from '../../../contracts/catalog-types.js';
import { createMonitoringApi } from '../../../infrastructure/monitoring-api.js';
import { useKpiTrackings } from '../../../application/hooks/use-kpi-trackings.js';
import { useIndicatorsReport, useKpiSummaryReport } from '../../../application/hooks/use-reports.js';

type Tab = 'tracking' | 'summary' | 'indicators';
type FilterState = { kpiType: string; kpiStatus: string; from: string; to: string };

const dateText = (value?: string | null) => value ? new Date(value).toLocaleDateString('es-CO') : '—';
const dateTimeText = (value?: string | null) => value ? new Date(value).toLocaleString('es-CO') : '—';
type StatusTone = 'good' | 'warn' | 'critical' | 'neutral';
const statusMeta = (value: string): { tone: StatusTone; icon: string } => {
  const normalized = value.toUpperCase().replace(/[^A-Z]/g, '_');
  if (/CRITICAL|HIGH/.test(normalized)) return { tone: 'critical', icon: '!' };
  if (/AT_RISK|MEDIUM|WARNING/.test(normalized)) return { tone: 'warn', icon: '!' };
  if (/INFO|LOW|OK|NORMAL|ON_TRACK|COMPLETED/.test(normalized)) return { tone: 'good', icon: '✓' };
  return { tone: 'neutral', icon: '•' };
};

function StatusBadge({ value }: { value: string }) {
  const status = statusMeta(value);
  return <span className={`${styles.badge} ${styles[status.tone]}`}><span className={styles.statusIcon} aria-hidden="true">{status.icon}</span><span>{value}</span></span>;
}

function KpiTypeValue({ id, catalogs }: { id: string; catalogs?: MonitoringMfeProps['catalogs'] }) {
  const kpiType = catalogs?.kpiTypes.find((item) => item.id === id);
  if (!kpiType) return <span title={`ID: ${id}`}>{id}</span>;
  return <span className={styles.catalogValue}><span>{kpiType.name}</span><span className={styles.catalogCode}>{kpiType.code}</span></span>;
}

function KpiTrackingModal({ onClose, onSubmit, catalogs, isSaving }: {
  onClose: () => void; onSubmit: (payload: KpiTrackingCreate) => Promise<void>;
  catalogs?: MonitoringMfeProps['catalogs']; isSaving: boolean;
}) {
  const [form, setForm] = useState({ ficha_tracking_id: '', kpi_type_id: '', current_value: '', threshold_value: '', kpi_status_id: '', period_start: '', period_end: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setFormError(null);
    if (!form.ficha_tracking_id || !form.kpi_type_id || !form.kpi_status_id || !form.current_value || !form.threshold_value || !form.period_start || !form.period_end) {
      setFormError('Completa todos los campos de la medición.'); return;
    }
    try { await onSubmit({ ...form, current_value: Number(form.current_value), threshold_value: Number(form.threshold_value) }); onClose(); }
    catch (cause) { setFormError(cause instanceof Error ? cause.message : 'No fue posible registrar la medición.'); }
  };
  return <div className={styles.modalBackdrop} role="presentation"><form className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="kpi-create-title" onSubmit={submit}>
    <div className={styles.modalHeader}><h2 id="kpi-create-title">Registrar medición KPI</h2><button className={styles.close} type="button" onClick={onClose} aria-label="Cerrar">×</button></div>
    <div className={styles.modalBody}>
      {formError && <div className={`${styles.error} ${styles.full}`} role="alert">{formError}</div>}
      <label className={styles.field}>ID de ficha_tracking<input value={form.ficha_tracking_id} onChange={(e) => update('ficha_tracking_id', e.target.value)} /></label>
      <label className={styles.field}>Tipo de KPI<select value={form.kpi_type_id} onChange={(e) => update('kpi_type_id', e.target.value)}><option value="">Selecciona</option>{catalogs?.kpiTypes.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label>
      <label className={styles.field}>Valor actual<input type="number" step="any" value={form.current_value} onChange={(e) => update('current_value', e.target.value)} /></label>
      <label className={styles.field}>Valor umbral<input type="number" step="any" value={form.threshold_value} onChange={(e) => update('threshold_value', e.target.value)} /></label>
      <label className={styles.field}>Estado KPI<select value={form.kpi_status_id} onChange={(e) => update('kpi_status_id', e.target.value)}><option value="">Selecciona</option>{catalogs?.kpiStatuses.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
      <label className={styles.field}>Inicio del periodo<input type="date" value={form.period_start} onChange={(e) => update('period_start', e.target.value)} /></label>
      <label className={styles.field}>Fin del periodo<input type="date" value={form.period_end} onChange={(e) => update('period_end', e.target.value)} /></label>
      <div className={styles.modalFooter}><button type="button" className={`${styles.button} ${styles.secondary}`} onClick={onClose}>Cancelar</button><button className={`${styles.button} ${styles.primary}`} disabled={isSaving}>{isSaving ? 'Guardando…' : 'Registrar'}</button></div>
    </div>
  </form></div>;
}

function TrackingDetail({ tracking, loading, error, catalogs, onClose }: { tracking: ReturnType<typeof useKpiTrackings>['selected']; loading: boolean; error: string | null; catalogs?: MonitoringMfeProps['catalogs']; onClose: () => void }) {
  if (!tracking && !loading && !error) return null;
  return <div className={styles.modalBackdrop} role="presentation"><div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="kpi-detail-title">
    <div className={styles.modalHeader}><h2 id="kpi-detail-title">Detalle de medición</h2><button className={styles.close} onClick={onClose} aria-label="Cerrar">×</button></div>
    {loading ? <div className={styles.detailState} role="status">Cargando detalle…</div> : error ? <div className={`${styles.error} ${styles.detailState}`} role="alert">{error}</div> : tracking && <div className={styles.modalBody}><p><strong>Ficha:</strong> {tracking.ficha_tracking_id}</p><p><strong>Tipo KPI:</strong> <KpiTypeValue id={tracking.kpi_type_id} catalogs={catalogs} /></p><p><strong>Valor actual:</strong> {tracking.current_value}</p><p><strong>Umbral:</strong> {tracking.threshold_value}</p><p><strong>Estado:</strong> <StatusBadge value={tracking.kpi_status_id} /></p><p><strong>Periodo:</strong> {dateText(tracking.period_start)} — {dateText(tracking.period_end)}</p><p className={styles.full}><strong>Medido:</strong> {dateTimeText(tracking.measured_at)}</p></div>}
  </div></div>;
}

export function MonitoringKpiPage({ httpClient, catalogs }: MonitoringMfeProps) {
  const api = useMemo(() => httpClient ? createMonitoringApi(httpClient) : null, [httpClient]);
  const [tab, setTab] = useState<Tab>('tracking'); const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ kpiType: '', kpiStatus: '', from: '', to: '' });
  if (!api) return <main className={styles.root}><section className={styles.configuration}><p className={styles.eyebrow}>HU-006 · Monitoring</p><h1>Panel de indicadores</h1><p>El shell debe proporcionar el cliente HTTP de frontend-platform para consultar Monitoring.</p></section></main>;
  return <KpiDashboard api={api} catalogs={catalogs} tab={tab} setTab={setTab} showForm={showForm} setShowForm={setShowForm} filters={filters} setFilters={setFilters} />;
}

function KpiDashboard({ api, catalogs, tab, setTab, showForm, setShowForm, filters, setFilters }: { api: ReturnType<typeof createMonitoringApi>; catalogs: MonitoringMfeProps['catalogs']; tab: Tab; setTab: (value: Tab) => void; showForm: boolean; setShowForm: (value: boolean) => void; filters: FilterState; setFilters: (value: FilterState) => void }) {
  const trackings = useKpiTrackings(api); const summary = useKpiSummaryReport(api, tab === 'summary'); const indicators = useIndicatorsReport(api, tab === 'indicators');
  const submitFilters = (event: FormEvent) => { event.preventDefault(); void trackings.load({ kpiType: filters.kpiType || undefined, kpiStatus: filters.kpiStatus || undefined, from: filters.from || undefined, to: filters.to || undefined }); };
  const create = async (payload: KpiTrackingCreate) => { await trackings.create(payload); };
  return <main className={styles.root}><div className={styles.page}>
    <header className={styles.pageHeader}><p className={styles.eyebrow}>HU-006 · Monitoring</p><h1>Panel de indicadores</h1><p className={styles.subtitle}>Consulta seguimientos KPI y los reportes calculados por el backend.</p></header>
    {!catalogs && <div className={styles.notice} role="status">Los catálogos de KPI deben ser proporcionados por la composición del shell. Los filtros y el formulario no inventan opciones locales.</div>}
    <section className={styles.panel}>
      <nav className={styles.tabs} aria-label="Vistas del panel"><button className={`${styles.tab} ${tab === 'tracking' ? styles.activeTab : ''}`} onClick={() => setTab('tracking')}>Seguimientos</button><button className={`${styles.tab} ${tab === 'summary' ? styles.activeTab : ''}`} onClick={() => setTab('summary')}>Resumen</button><button className={`${styles.tab} ${tab === 'indicators' ? styles.activeTab : ''}`} onClick={() => setTab('indicators')}>Indicadores</button></nav>
      {tab === 'tracking' && <><form className={styles.toolbar} onSubmit={submitFilters}><label className={styles.field}>Tipo KPI<select value={filters.kpiType} onChange={(e) => setFilters({ ...filters, kpiType: e.target.value })}><option value="">Todos</option>{catalogs?.kpiTypes.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}</select></label><label className={styles.field}>Estado<select value={filters.kpiStatus} onChange={(e) => setFilters({ ...filters, kpiStatus: e.target.value })}><option value="">Todos</option>{catalogs?.kpiStatuses.map((item) => <option key={item.id} value={item.code}>{item.code}</option>)}</select></label><label className={styles.field}>Desde<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label><label className={styles.field}>Hasta<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label><button className={`${styles.button} ${styles.secondary}`} type="submit">Aplicar</button></form><div className={styles.panelBody}><div className={styles.sectionHeader}><div><h2>Mediciones registradas</h2><p>Los valores, estados y paginación son entregados por Monitoring.</p></div><button className={`${styles.button} ${styles.primary}`} onClick={() => setShowForm(true)} disabled={!catalogs}>Registrar medición</button></div>{trackings.error && <div className={styles.error} role="alert">{trackings.error}</div>}{trackings.isLoading && trackings.data.length === 0 ? <div className={styles.empty}>Cargando mediciones…</div> : trackings.data.length === 0 ? <div className={styles.empty}>No hay mediciones para los filtros seleccionados.</div> : <><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Ficha</th><th>KPI</th><th>Actual</th><th>Umbral</th><th>Estado</th><th>Medido</th></tr></thead><tbody>{trackings.data.map((item) => <tr className={styles.clickable} tabIndex={0} key={item.id} onClick={() => void trackings.openDetail(item.id)} onKeyDown={(e) => e.key === 'Enter' && void trackings.openDetail(item.id)}><td>{item.ficha_tracking_id}</td><td><KpiTypeValue id={item.kpi_type_id} catalogs={catalogs} /></td><td>{item.current_value}</td><td>{item.threshold_value}</td><td><StatusBadge value={item.kpi_status_id} /></td><td>{dateTimeText(item.measured_at)}</td></tr>)}</tbody></table></div>{trackings.hasMore && <div className={styles.pagination}><span>Hay más mediciones disponibles.</span><button className={`${styles.button} ${styles.secondary}`} type="button" onClick={() => void trackings.loadMore()} disabled={trackings.isLoading || !trackings.nextCursor}>{trackings.isLoading ? 'Cargando…' : 'Cargar más'}</button></div>}</>}</div></>}
      {tab === 'summary' && <SummaryCards title="Resumen por ficha" loading={summary.isLoading} error={summary.error} rows={summary.data} />}
      {tab === 'indicators' && <ReportTable title="Indicadores agregados" loading={indicators.isLoading} error={indicators.error} rows={indicators.data.map((item) => [item.kpi_status_code, item.risk_level_code, item.ficha_count, item.avg_active_alert_count ?? '—', dateTimeText(item.as_of)])} headers={['Estado', 'Riesgo', 'Fichas', 'Promedio alertas', 'Corte']} />}
    </section>
    {showForm && <KpiTrackingModal onClose={() => setShowForm(false)} onSubmit={create} catalogs={catalogs} isSaving={trackings.isCreating} />}{(trackings.selected || trackings.detailLoading || trackings.detailError) && <TrackingDetail tracking={trackings.selected} loading={trackings.detailLoading} error={trackings.detailError} catalogs={catalogs} onClose={trackings.closeDetail} />}
  </div></main>;
}

function ReportTable({ title, loading, error, rows, headers }: { title: string; loading: boolean; error: string | null; rows: unknown[][]; headers: string[] }) {
  return <div className={styles.panelBody}><div className={styles.sectionHeader}><div><h2>{title}</h2><p>Reporte calculado por Monitoring; no se agregan datos en el cliente.</p></div></div>{error && <div className={styles.error} role="alert">{error}</div>}{loading ? <div className={styles.empty}>Cargando reporte…</div> : rows.length === 0 ? <div className={styles.empty}>No hay datos para mostrar.</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{String(value)}</td>)}</tr>)}</tbody></table></div>}</div>;
}

function SummaryCards({ title, loading, error, rows }: { title: string; loading: boolean; error: string | null; rows: KpiSummaryReportEntry[] }) {
  return <div className={styles.panelBody}><div className={styles.sectionHeader}><div><h2>{title}</h2><p>Reporte calculado por Monitoring; no se agregan datos en el cliente.</p></div></div>{error && <div className={styles.error} role="alert">{error}</div>}{loading ? <div className={styles.empty}>Cargando reporte…</div> : rows.length === 0 ? <div className={styles.empty}>No hay datos para mostrar.</div> : <div className={styles.summaryCards}>{rows.map((item) => <article className={styles.summaryCard} key={`${item.ficha_tracking_id}-${item.kpi_type_code}-${item.measured_at}`}><div className={styles.summaryCardHeader}><div><p className={styles.summaryCardLabel}>KPI</p><h3>{item.kpi_type_name}</h3><p className={styles.summaryCardCode}>{item.kpi_type_code}</p></div><StatusBadge value={item.kpi_status_code} /></div><dl className={styles.summaryCardDetails}><div><dt>Ficha</dt><dd>{item.ficha_tracking_id}</dd></div><div><dt>Valor actual</dt><dd>{item.current_value}</dd></div><div><dt>Unidad</dt><dd>{item.unit}</dd></div><div><dt>Umbral</dt><dd>{item.threshold_value ?? '—'}</dd></div><div><dt>Riesgo</dt><dd>{item.risk_level_code}</dd></div><div><dt>Medido</dt><dd>{dateTimeText(item.measured_at)}</dd></div></dl></article>)}</div>}</div>;
}
