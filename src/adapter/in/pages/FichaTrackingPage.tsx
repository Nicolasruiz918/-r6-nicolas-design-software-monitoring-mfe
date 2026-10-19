import { useEffect, useMemo, useState } from 'react';

import { PAGE_SIZE_OPTIONS, useTrackingSessions } from '../../../application/hooks/useTrackingSessions.js';
import { useFichaTrackings } from '../../../application/hooks/useFichaTrackings.js';
import { useKpiStatuses } from '../../../application/hooks/useKpiStatuses.js';
import type { FichaTrackingPort } from '../../../application/ports/ficha-tracking.js';
import type { MonitoringCatalogPort } from '../../../application/ports/monitoring-catalogs.js';
import type { KpiStatus, Pagination } from '../../../contracts/catalog-types.js';
import {
  MON_TRACKING_SESSION_CREATE,
  hasCapability,
  type FichaOption,
  type MonitoringUserContext,
} from '../../../contracts/remote-props.js';
import type { TrackingSessionCreate } from '../../../contracts/tracking-types.js';
import { LoadingState } from '../components/CatalogControls.js';
import { CatalogModal } from '../components/CatalogForms.js';
import { SESSION_TYPE_LABELS, TrackingSessionForm } from '../components/TrackingForms.js';
import {
  formatAttendance,
  formatLongDate,
  formatPercent,
  formatShortDate,
  isTrackingOverdue,
} from '../components/trackingFormat.js';
import styles from '../../../App.module.css';

type Tone = 'success' | 'warning' | 'danger' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
  success: styles.trkSuccess,
  warning: styles.trkWarning,
  danger: styles.trkDanger,
  neutral: styles.trkNeutral,
};

/** Mismo mapeo de estados que el prototipo (components.js). Nunca solo color: siempre icono + texto. */
const STATUS_VIEW: Record<string, { label: string; tone: Tone; icon: string }> = {
  ON_TRACK: { label: 'En seguimiento', tone: 'success', icon: '✓' },
  AT_RISK: { label: 'En riesgo', tone: 'warning', icon: '▲' },
  CRITICAL: { label: 'Crítico', tone: 'danger', icon: '▲' },
};

function Badge({ tone, icon, children }: { tone: Tone; icon: string; children: string }) {
  return (
    <span className={`${styles.trkBadge} ${TONE_CLASS[tone]}`}>
      <span aria-hidden="true">{icon}</span>
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: KpiStatus | undefined }) {
  if (!status) return <Badge tone="neutral" icon="●">Sin estado</Badge>;
  const view = STATUS_VIEW[status.code];
  if (!view) return <Badge tone="neutral" icon="●">{status.description ?? status.code}</Badge>;
  return <Badge tone={view.tone} icon={view.icon}>{view.label}</Badge>;
}

function SectionError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className={styles.trkFormError} role="alert">
      <strong>{title}</strong> <span>{message}</span>
      {onRetry ? <button className={styles.secondaryButton} type="button" onClick={onRetry}>Reintentar</button> : null}
    </div>
  );
}

function pageNumbers(current: number, total: number): number[] {
  const size = Math.min(5, Math.max(1, total));
  let start = Math.max(1, current - Math.floor(size / 2));
  if (start + size - 1 > total) start = Math.max(1, total - size + 1);
  return Array.from({ length: size }, (_, index) => start + index);
}

function SessionsFooter({
  pagination,
  onPage,
  onPageSize,
}: {
  pagination: Pagination;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const { page, page_size: pageSize, total_items: totalItems, total_pages: totalPages } = pagination;
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return (
    <div className={styles.trkFooter}>
      <span>Mostrando {start}–{end} de {totalItems}</span>
      <nav className={styles.trkPager} aria-label="Paginación">
        <button className={styles.trkPageBtn} type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Anterior</button>
        {pageNumbers(page, totalPages).map((number) => (
          <button
            key={number}
            type="button"
            className={`${styles.trkPageBtn} ${number === page ? styles.trkPageActive : ''}`}
            aria-current={number === page ? 'page' : undefined}
            aria-label={`Página ${number}`}
            onClick={() => onPage(number)}
          >
            {number}
          </button>
        ))}
        <button className={styles.trkPageBtn} type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Siguiente ›</button>
      </nav>
      <label className={styles.trkPageSize}>
        <select aria-label="Filas por página" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>
          {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <span>por página</span>
      </label>
    </div>
  );
}

export function FichaTrackingPage({
  trackingApi,
  catalogApi,
  fichaId,
  fichaLabel,
  fichaOptions,
  user,
}: {
  trackingApi: FichaTrackingPort;
  catalogApi: MonitoringCatalogPort;
  /** Entregada por el shell (selector de academic-management-mfe). */
  fichaId?: string;
  fichaLabel?: string;
  /** Solo modo independiente: fichas de ejemplo para el selector. */
  fichaOptions?: FichaOption[];
  /** Usuario autenticado entregado por el shell (identidad de instructor + capacidades). */
  user?: MonitoringUserContext;
}) {
  const [selectedFicha, setSelectedFicha] = useState<string | undefined>(fichaId ?? fichaOptions?.[0]?.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (fichaId) setSelectedFicha(fichaId);
  }, [fichaId]);

  const activeFichaId = fichaId ?? selectedFicha;
  const trackings = useFichaTrackings(trackingApi, activeFichaId);
  const tracking = trackings.selected; // solo existe despues del click en una fila (E3)
  const sessions = useTrackingSessions(trackingApi, tracking?.id);
  const kpiStatuses = useKpiStatuses(catalogApi);

  const statusById = useMemo(() => new Map(kpiStatuses.data.map((status) => [status.id, status])), [kpiStatuses.data]);
  const status = tracking ? statusById.get(tracking.overall_status_id) : undefined;
  const detail = sessions.selectedSession;

  // Permisos: sin capacidad (o sin user) no se puede registrar (falla cerrado).
  const canCreate = hasCapability(user?.capabilities, MON_TRACKING_SESSION_CREATE);
  // La sesion se registra a nombre del instructor autenticado, nunca del instructor asignado a la ficha.
  const ownInstructorId = user?.instructorId?.trim() || undefined;
  // Rule (pending product/backend approval): without an own instructor id (e.g. Coordinator),
  // the session is registered on behalf of the instructor assigned to the tracking.
  const actingInstructorId = ownInstructorId ?? tracking?.assigned_instructor_id;
  const onBehalf = !ownInstructorId;
  const createBlockedReason = !canCreate ? 'No tienes permiso para registrar seguimientos.' : null;

  async function saveSession(payload: TrackingSessionCreate) {
    await sessions.create(payload);
    void trackings.refresh();
    setToast(
      payload.requires_follow_up === true
        ? 'Seguimiento registrado. Se generará una alerta de seguimiento.'
        : 'Seguimiento registrado.',
    );
    setModalOpen(false);
  }

  return (
    <section className={styles.page}>
      <header className={`${styles.pageHeader} ${styles.trkHeader}`}>
        <div>
          <h1>Seguimiento de ficha</h1>
          <p className={styles.subtitle}>Registra mediciones periódicas de asistencia y avance curricular.</p>
        </div>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={!tracking || createBlockedReason !== null}
          aria-describedby={createBlockedReason ? 'trk-create-blocked' : undefined}
          onClick={() => { sessions.resetMutationError(); setModalOpen(true); }}
        >
          + Registrar seguimiento
        </button>
      </header>

      {createBlockedReason ? (
        <p id="trk-create-blocked" className={styles.trkNotice} role="note">{createBlockedReason}</p>
      ) : null}

      {toast ? (
        <div className={styles.trkToast} role="status" aria-live="polite">
          <span>{toast}</span>
          <button type="button" aria-label="Cerrar mensaje" onClick={() => setToast(null)}>×</button>
        </div>
      ) : null}

      <section className={styles.trkSummary} aria-label="Resumen de la ficha">
        <label className={styles.field}>
          Ficha
          {fichaId ? (
            <select value={fichaId} disabled>
              <option value={fichaId}>{fichaLabel ?? fichaId}</option>
            </select>
          ) : (
            <select
              value={selectedFicha ?? ''}
              onChange={(event) => setSelectedFicha(event.target.value || undefined)}
              disabled={!fichaOptions || fichaOptions.length === 0}
            >
              {!fichaOptions || fichaOptions.length === 0 ? <option value="">Sin fichas disponibles</option> : null}
              {fichaOptions?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          )}
        </label>
        <dl className={styles.trkSummaryItem}>
          <dt>Estado</dt>
          <dd>{tracking ? <StatusBadge status={status} /> : '—'}</dd>
        </dl>
        <dl className={styles.trkSummaryItem}>
          <dt>Último seguimiento</dt>
          <dd>{formatLongDate(tracking?.last_tracking_date)}</dd>
        </dl>
        <dl className={styles.trkSummaryItem}>
          <dt>Próximo</dt>
          <dd>{formatLongDate(tracking?.next_tracking_date)}</dd>
        </dl>
      </section>

      {tracking && tracking.active_alert_count > 0 ? (
        <p className={styles.trkAlertCount}>▲ Alertas activas de la ficha: <strong>{tracking.active_alert_count}</strong></p>
      ) : null}

      {!activeFichaId ? (
        <p className={styles.trkEmpty}>Selecciona una ficha para consultar su seguimiento.</p>
      ) : trackings.isLoading ? (
        <LoadingState label="seguimiento de la ficha" />
      ) : trackings.error ? (
        <SectionError title="No se pudo cargar el seguimiento." message={trackings.error} onRetry={() => void trackings.reload()} />
      ) : trackings.items.length === 0 ? (
        <p className={styles.trkEmpty}>Esta ficha aún no tiene registros de seguimiento.</p>
      ) : (
        <>
          {/* E1 + E3: lista de seguimientos de la ficha; click en fila -> GET /ficha-trackings/{id} */}
          <section className={styles.trkCard} aria-label="Seguimientos de la ficha">
            <div className={styles.trkTableWrap}>
              <table className={styles.trkTable}>
                <caption className={styles.trkSrOnly}>Seguimientos de la ficha</caption>
                <thead>
                  <tr>
                    <th scope="col">Seguimiento</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Último seguimiento</th>
                    <th scope="col">Próximo</th>
                    <th scope="col">Alertas activas</th>
                  </tr>
                </thead>
                <tbody>
                  {trackings.items.map((item, index) => (
                    <tr
                      key={item.id}
                      className={styles.trkClickRow}
                      aria-current={tracking?.id === item.id ? 'true' : undefined}
                      onClick={() => void trackings.select(item.id)}
                    >
                      <td data-label="Seguimiento">
                        <button
                          className={styles.trkLinkBtn}
                          type="button"
                          aria-label={`Abrir seguimiento ${index + 1}`}
                          onClick={(event) => { event.stopPropagation(); void trackings.select(item.id); }}
                        >
                          Seguimiento {index + 1}
                        </button>
                      </td>
                      <td data-label="Estado"><StatusBadge status={statusById.get(item.overall_status_id)} /></td>
                      <td data-label="Último seguimiento">{formatLongDate(item.last_tracking_date)}</td>
                      <td data-label="Próximo">{formatLongDate(item.next_tracking_date)}</td>
                      <td data-label="Alertas activas">{item.active_alert_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {trackings.isLoadingDetail ? <LoadingState label="detalle del seguimiento" /> : null}
            {trackings.detailError ? (
              <SectionError title="No se pudo cargar el detalle del seguimiento." message={trackings.detailError} />
            ) : null}
          </section>

          {/* E4: sesiones del seguimiento abierto */}
          {!tracking ? (
            trackings.isLoadingDetail || trackings.detailError ? null : (
              <p className={styles.trkEmpty}>Selecciona un seguimiento para ver sus sesiones.</p>
            )
          ) : (
            <section className={styles.trkCard}>
              {sessions.isLoading ? <LoadingState label="sesiones de seguimiento" /> : null}
              {!sessions.isLoading && sessions.error ? (
                <SectionError title="No se pudieron cargar las sesiones." message={sessions.error} onRetry={sessions.reload} />
              ) : null}

              {!sessions.isLoading && !sessions.error && sessions.data.length === 0 ? (
                <div className={styles.trkEmpty}>
                  <p>Este seguimiento aún no tiene sesiones registradas.</p>
                  {isTrackingOverdue(tracking.last_tracking_date, tracking.next_tracking_date) ? (
                    <p className={styles.trkAlert} role="alert">
                      ▲ Seguimiento pendiente: el próximo seguimiento está vencido o han pasado más de 35 días sin registrar una sesión.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {!sessions.isLoading && !sessions.error && sessions.data.length > 0 ? (
                <>
                  <div className={styles.trkTableWrap}>
                    <table className={styles.trkTable}>
                      <caption className={styles.trkSrOnly}>Sesiones de seguimiento</caption>
                      <thead>
                        <tr>
                          <th scope="col">Fecha</th>
                          <th scope="col">Tipo</th>
                          <th scope="col">Asistencia</th>
                          <th scope="col">Avance curricular</th>
                          <th scope="col">Requiere seguimiento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.data.map((session) => (
                          <tr key={session.id} className={styles.trkClickRow} onClick={() => void sessions.loadDetail(session.id)}>
                            <td data-label="Fecha">
                              <button
                                className={styles.trkLinkBtn}
                                type="button"
                                aria-label={`Ver detalle de la sesión del ${formatShortDate(session.session_date)}`}
                                onClick={(event) => { event.stopPropagation(); void sessions.loadDetail(session.id); }}
                              >
                                {formatShortDate(session.session_date)}
                              </button>
                            </td>
                            <td data-label="Tipo">{SESSION_TYPE_LABELS[session.session_type] ?? session.session_type}</td>
                            <td data-label="Asistencia">
                              {formatAttendance(session.attendance_count, session.total_learners, session.attendance_percentage)}
                            </td>
                            <td data-label="Avance curricular">
                              <div>{formatPercent(session.curriculum_progress_percentage)}</div>
                              {session.curriculum_progress_percentage !== null && session.curriculum_progress_percentage !== undefined ? (
                                <progress
                                  className={styles.trkProgress}
                                  max={100}
                                  value={session.curriculum_progress_percentage}
                                  aria-label="Avance curricular"
                                />
                              ) : null}
                            </td>
                            <td data-label="Requiere seguimiento">
                              {session.requires_follow_up ? (
                                <Badge tone="warning" icon="▲">Sí</Badge>
                              ) : (
                                <Badge tone="success" icon="✓">No</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {sessions.pagination ? (
                    <SessionsFooter pagination={sessions.pagination} onPage={sessions.setPage} onPageSize={sessions.changePageSize} />
                  ) : null}
                </>
              ) : null}
            </section>
          )}
        </>
      )}

      {modalOpen && tracking && actingInstructorId && createBlockedReason === null ? (
        <TrackingSessionForm
          instructorId={actingInstructorId}
          onBehalf={onBehalf}
          isSaving={sessions.isMutating}
          error={sessions.mutationError}
          onSubmit={saveSession}
          onClose={() => setModalOpen(false)}
        />
      ) : null}

      {/* E5: detalle de sesion. Carga y errores viven dentro del modal. */}
      {sessions.isDetailOpen ? (
        <CatalogModal title="Detalle de la sesión" onClose={sessions.clearSelected}>
          <div className={styles.modalBody} aria-busy={sessions.isLoadingDetail}>
            {sessions.isLoadingDetail ? (
              <div className={styles.fullField}>
                <LoadingState label="detalle de la sesión" />
              </div>
            ) : null}
            {!sessions.isLoadingDetail && sessions.detailError ? (
              <div className={`${styles.trkFormError} ${styles.fullField}`} role="alert">
                <strong>No se pudo cargar la sesión.</strong> <span>{sessions.detailError}</span>
                <button className={styles.secondaryButton} type="button" onClick={sessions.retryDetail}>Reintentar</button>
              </div>
            ) : null}
            {detail ? (
              <dl className={`${styles.trkDetailGrid} ${styles.fullField}`}>
                <div><dt>Fecha</dt><dd>{formatShortDate(detail.session_date)}</dd></div>
                <div><dt>Tipo</dt><dd>{SESSION_TYPE_LABELS[detail.session_type] ?? detail.session_type}</dd></div>
                <div><dt>Asistencia</dt><dd>{formatAttendance(detail.attendance_count, detail.total_learners, detail.attendance_percentage)}</dd></div>
                <div><dt>Avance curricular</dt><dd>{formatPercent(detail.curriculum_progress_percentage)}</dd></div>
                <div><dt>Requiere seguimiento</dt><dd>{detail.requires_follow_up ? 'Sí' : 'No'}</dd></div>
                <div><dt>Instructor</dt><dd>{detail.instructor_id}</dd></div>
                <div className={styles.fullField}><dt>Observaciones</dt><dd>{detail.observations ? detail.observations : '—'}</dd></div>
              </dl>
            ) : null}
            <footer className={`${styles.modalFooter} ${styles.fullField}`}>
              <button className={styles.secondaryButton} type="button" onClick={sessions.clearSelected}>Cerrar</button>
            </footer>
          </div>
        </CatalogModal>
      ) : null}
    </section>
  );
}