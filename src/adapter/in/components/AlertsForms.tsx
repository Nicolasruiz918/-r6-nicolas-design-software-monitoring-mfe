import { useState, type FormEvent } from 'react';

import type {
  GeneratedAlert,
  GeneratedAlertResolve,
  ImprovementPlanCreate,
  PlanStatus,
} from '../../../contracts/alerts-plans-types.js';
import { CatalogModal } from './CatalogForms.js';
import styles from '../../../App.module.css';

export const PLAN_STATUSES: Array<{ value: PlanStatus; label: string }> = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'IN_PROGRESS', label: 'En curso' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

export const PLAN_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  PLAN_STATUSES.map((option) => [option.value, option.label]),
);

export function ResolveAlertForm({
  alert,
  isSaving,
  error,
  onSubmit,
  onClose,
}: {
  alert: GeneratedAlert;
  isSaving: boolean;
  error: string | null;
  onSubmit: (payload: GeneratedAlertResolve) => Promise<void>;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const notesError = submitted && !notes.trim() ? 'Las notas de resolución son obligatorias.' : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!notes.trim()) return;
    try {
      await onSubmit({ resolution_notes: notes.trim() });
    } catch {
      // El hook expone el error de la API dentro del formulario y el modal sigue abierto.
    }
  }

  return (
    <CatalogModal title="Resolver alerta" onClose={onClose}>
      <form className={styles.modalBody} onSubmit={handleSubmit} noValidate>
        {error ? <div className={styles.trkFormError} role="alert">{error}</div> : null}
        <p className={`${styles.trkNotice} ${styles.fullField}`}>{alert.description}</p>
        <label className={`${styles.field} ${styles.fullField}`}>
          Notas de resolución
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            aria-invalid={notesError ? true : undefined}
            aria-describedby={notesError ? 'alert-notes-error' : undefined}
          />
          {notesError ? <span id="alert-notes-error" className={styles.trkFieldError} role="alert">▲ {notesError}</span> : null}
        </label>
        <footer className={styles.modalFooter}>
          <button className={styles.secondaryButton} type="button" onClick={onClose}>Cancelar</button>
          <button className={styles.primaryButton} type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando…' : 'Confirmar'}
          </button>
        </footer>
      </form>
    </CatalogModal>
  );
}

export function ImprovementPlanForm({
  alert,
  isSaving,
  error,
  onSubmit,
  onClose,
}: {
  /** Alerta resuelta de la que nace el plan (E4). */
  alert: GeneratedAlert;
  isSaving: boolean;
  error: string | null;
  onSubmit: (payload: ImprovementPlanCreate) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [actions, setActions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const missing = (value: string) => submitted && !value.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!title.trim() || !description.trim() || !actions.trim() || !dueDate) return;
    try {
      await onSubmit({
        ficha_tracking_id: alert.ficha_tracking_id,
        generated_alert_id: alert.id,
        title: title.trim(),
        description: description.trim(),
        specific_actions: actions.trim(),
        due_date: dueDate,
      });
    } catch {
      // El hook expone el error de la API dentro del formulario y el modal sigue abierto.
    }
  }

  return (
    <CatalogModal title="Nuevo plan de mejoramiento" onClose={onClose}>
      <form className={styles.modalBody} onSubmit={handleSubmit} noValidate>
        {error ? <div className={styles.trkFormError} role="alert">{error}</div> : null}
        <p className={`${styles.trkNotice} ${styles.fullField}`} role="note">
          Plan asociado a la alerta resuelta: {alert.description}
        </p>
        <label className={`${styles.field} ${styles.fullField}`}>
          Título
          <input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} aria-invalid={missing(title) ? true : undefined} />
          {missing(title) ? <span className={styles.trkFieldError} role="alert">▲ El título es obligatorio.</span> : null}
        </label>
        <label className={`${styles.field} ${styles.fullField}`}>
          Descripción
          <textarea value={description} rows={3} onChange={(event) => setDescription(event.target.value)} aria-invalid={missing(description) ? true : undefined} />
          {missing(description) ? <span className={styles.trkFieldError} role="alert">▲ La descripción es obligatoria.</span> : null}
        </label>
        <label className={`${styles.field} ${styles.fullField}`}>
          Acciones específicas
          <textarea value={actions} rows={3} onChange={(event) => setActions(event.target.value)} aria-invalid={missing(actions) ? true : undefined} />
          {missing(actions) ? <span className={styles.trkFieldError} role="alert">▲ Las acciones específicas son obligatorias.</span> : null}
        </label>
        <label className={`${styles.field} ${styles.fullField}`}>
          Fecha límite
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-invalid={submitted && !dueDate ? true : undefined} />
          {submitted && !dueDate ? <span className={styles.trkFieldError} role="alert">▲ La fecha límite es obligatoria.</span> : null}
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