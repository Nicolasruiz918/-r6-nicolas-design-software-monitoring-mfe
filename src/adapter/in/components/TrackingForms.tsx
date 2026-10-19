import { useState, type FormEvent } from 'react';

import type { SessionType, TrackingSessionCreate } from '../../../contracts/tracking-types.js';
import { CatalogModal } from './CatalogForms.js';
import styles from '../../../App.module.css';

export const SESSION_TYPES: Array<{ value: SessionType; label: string }> = [
  { value: 'ACADEMIC', label: 'Académico' },
  { value: 'WELLNESS', label: 'Bienestar' },
  { value: 'PROJECT', label: 'Proyecto' },
  { value: 'PRODUCTIVE_STAGE', label: 'Etapa productiva' },
];

export const SESSION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SESSION_TYPES.map((option) => [option.value, option.label]),
);

function toOptionalNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

function isInvalidCount(value: number | undefined): boolean {
  return value !== undefined && (!Number.isInteger(value) || value < 0);
}

export function TrackingSessionForm({
  instructorId,
  onBehalf = false,
  isSaving,
  error,
  onSubmit,
  onClose,
}: {
  /** Se autocompleta (no se pide en el formulario): instructor autenticado que entrega el shell (user.instructorId). */
  instructorId: string;
  /** true cuando el usuario no es instructor (ej. Coordinador): se registra a nombre del instructor asignado. */
  onBehalf?: boolean;
  isSaving: boolean;
  error: string | null;
  onSubmit: (payload: TrackingSessionCreate) => Promise<void>;
  onClose: () => void;
}) {
  const [sessionType, setSessionType] = useState<SessionType>('ACADEMIC');
  const [sessionDate, setSessionDate] = useState('');
  const [attendance, setAttendance] = useState('');
  const [totalLearners, setTotalLearners] = useState('');
  const [progress, setProgress] = useState('');
  const [observations, setObservations] = useState('');
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const attendanceCount = toOptionalNumber(attendance);
  const total = toOptionalNumber(totalLearners);
  const progressValue = toOptionalNumber(progress);

  const errors: { date?: string; attendance?: string; total?: string; progress?: string } = {};
  if (submitted && !sessionDate) errors.date = 'La fecha es obligatoria.';
  if (isInvalidCount(attendanceCount)) {
    errors.attendance = 'Ingresa un número entero mayor o igual a 0.';
  } else if (attendanceCount !== undefined && total !== undefined && attendanceCount > total) {
    errors.attendance = 'Los asistentes no pueden superar el total de aprendices.';
  }
  if (isInvalidCount(total)) errors.total = 'Ingresa un número entero mayor o igual a 0.';
  if (progressValue !== undefined && (!Number.isFinite(progressValue) || progressValue < 0 || progressValue > 100)) {
    errors.progress = 'El avance curricular debe estar entre 0 y 100.';
  }

  const preview =
    attendanceCount !== undefined && total !== undefined && total > 0 && Number.isFinite(attendanceCount)
      ? `→ ${Math.round((attendanceCount / total) * 10000) / 100}% de asistencia`
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!sessionDate || errors.attendance || errors.total || errors.progress) return;
    try {
      await onSubmit({
        instructor_id: instructorId,
        session_date: sessionDate,
        session_type: sessionType,
        requires_follow_up: requiresFollowUp,
        ...(attendanceCount === undefined ? {} : { attendance_count: attendanceCount }),
        ...(total === undefined ? {} : { total_learners: total }),
        ...(progressValue === undefined ? {} : { curriculum_progress_percentage: progressValue }),
        ...(observations.trim() ? { observations: observations.trim() } : {}),
      });
    } catch {
      // El hook expone el error de la API dentro del formulario y el modal sigue abierto.
    }
  }

  return (
    <CatalogModal title="Registrar seguimiento" onClose={onClose}>
      <form className={styles.modalBody} onSubmit={handleSubmit} noValidate>
        {error ? <div className={styles.trkFormError} role="alert">{error}</div> : null}
        {onBehalf ? (
          <p className={`${styles.trkNotice} ${styles.fullField}`} role="note">
            Esta sesión se registrará a nombre del instructor asignado a la ficha ({instructorId}).
          </p>
        ) : null}

        <label className={`${styles.field} ${styles.fullField}`}>
          Tipo de sesión
          <select value={sessionType} onChange={(event) => setSessionType(event.target.value as SessionType)}>
            {SESSION_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <label className={`${styles.field} ${styles.fullField}`}>
          Fecha
          <input
            type="date"
            value={sessionDate}
            onChange={(event) => setSessionDate(event.target.value)}
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={errors.date ? 'trk-date-error' : undefined}
            required
          />
          {errors.date ? <span id="trk-date-error" className={styles.trkFieldError}>{errors.date}</span> : null}
        </label>

        <label className={styles.field}>
          Asistentes
          <input
            type="number"
            min={0}
            step={1}
            value={attendance}
            onChange={(event) => setAttendance(event.target.value)}
            aria-invalid={errors.attendance ? true : undefined}
            aria-describedby={errors.attendance ? 'trk-attendance-error' : undefined}
          />
          {errors.attendance ? (
            <span id="trk-attendance-error" className={styles.trkFieldError} role="alert">▲ {errors.attendance}</span>
          ) : null}
        </label>

        <label className={styles.field}>
          Total de aprendices
          <input
            type="number"
            min={0}
            step={1}
            value={totalLearners}
            onChange={(event) => setTotalLearners(event.target.value)}
            aria-invalid={errors.total ? true : undefined}
          />
          {errors.total ? <span className={styles.trkFieldError}>▲ {errors.total}</span> : null}
          {preview ? <span className={styles.trkFieldHelp}>{preview}</span> : null}
        </label>

        <label className={`${styles.field} ${styles.fullField}`}>
          Avance curricular (%)
          <input
            type="number"
            min={0}
            max={100}
            step="any"
            value={progress}
            onChange={(event) => setProgress(event.target.value)}
            aria-invalid={errors.progress ? true : undefined}
          />
          {errors.progress ? <span className={styles.trkFieldError}>▲ {errors.progress}</span> : null}
        </label>

        <label className={`${styles.field} ${styles.fullField}`}>
          Observaciones
          <textarea
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            rows={4}
            placeholder="Ej. Se avanzó en la unidad 3, dos aprendices en riesgo de deserción"
          />
        </label>

        <label className={`${styles.checkboxField} ${styles.fullField}`}>
          <input type="checkbox" checked={requiresFollowUp} onChange={(event) => setRequiresFollowUp(event.target.checked)} />
          Requiere seguimiento adicional
        </label>

        <footer className={styles.modalFooter}>
          <button className={styles.secondaryButton} type="button" onClick={onClose}>Cancelar</button>
          <button className={styles.primaryButton} type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </form>
    </CatalogModal>
  );
}