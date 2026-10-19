import { useEffect, useState, type FormEvent } from 'react';

import type {
  AlertType,
  AlertTypeCreate,
  AlertTypeUpdate,
  KpiType,
  KpiTypeCreate,
  KpiTypeUpdate,
  KpiUnit,
  ThresholdUnit,
} from '../../../contracts/catalog-types.js';
import styles from '../../../App.module.css';
import { CatalogModal } from './AccessibleModal.js';

export { CatalogModal };

const KPI_UNITS: Array<{ value: KpiUnit; label: string }> = [
  { value: 'PERCENTAGE', label: 'Porcentaje' },
  { value: 'COUNT', label: 'Cantidad' },
  { value: 'HOURS', label: 'Horas' },
  { value: 'DAYS', label: 'Días' },
];

const THRESHOLD_UNITS: Array<{ value: ThresholdUnit; label: string }> = [
  { value: 'PERCENTAGE', label: 'Porcentaje' },
  { value: 'COUNT', label: 'Cantidad' },
  { value: 'DAYS', label: 'Días' },
  { value: 'HOURS', label: 'Horas' },
];

function FieldError({ message, id }: { message: string | undefined; id: string }) {
  return message ? (
    <span className={styles.fieldError} id={id} role="alert">
      {message}
    </span>
  ) : null;
}

export function KpiTypeForm({
  item,
  isSaving,
  error,
  onSubmit,
  onClose,
}: {
  item: KpiType | null;
  isSaving: boolean;
  error: string | null;
  onSubmit: (payload: KpiTypeCreate | KpiTypeUpdate) => Promise<void>;
  onClose: () => void;
}) {
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [unit, setUnit] = useState<KpiUnit>(item?.unit ?? 'PERCENTAGE');
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setCode(item?.code ?? '');
    setName(item?.name ?? '');
    setDescription(item?.description ?? '');
    setUnit(item?.unit ?? 'PERCENTAGE');
    setIsActive(item?.is_active ?? true);
  }, [item]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || (!item && !code.trim())) {
      setValidationError('Completa los campos obligatorios.');
      return;
    }
    setValidationError(null);
    try {
      if (item) {
        await onSubmit({
          name: name.trim(),
          description: description.trim(),
          unit,
          is_active: isActive,
        });
      } else {
        await onSubmit({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          unit,
        });
      }
    } catch {
      // The hook exposes the API error in the form while keeping the modal open.
    }
  }

  return (
    <CatalogModal title={item ? 'Editar tipo de KPI' : 'Nuevo tipo de KPI'} onClose={onClose}>
      <form className={styles.modalBody} onSubmit={handleSubmit} noValidate>
        {error ? <div className={styles.formError} role="alert">{error}</div> : null}
        {validationError ? <div className={styles.formError} role="alert">{validationError}</div> : null}
        <label className={styles.field}>
          Código
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={Boolean(item)}
            required={!item}
            maxLength={50}
            aria-describedby="kpi-code-error"
          />
          <FieldError id="kpi-code-error" message={!item && !code.trim() ? undefined : undefined} />
        </label>
        <label className={styles.field}>
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
        </label>
        <label className={styles.field}>
          Unidad
          <select value={unit} onChange={(event) => setUnit(event.target.value as KpiUnit)}>
            {KPI_UNITS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        {item ? (
          <label className={styles.checkboxField}>
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            Activo
          </label>
        ) : null}
        <label className={`${styles.field} ${styles.fullField}`}>
          Descripción
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
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

export function AlertTypeForm({
  item,
  isSaving,
  error,
  onSubmit,
  onClose,
}: {
  item: AlertType | null;
  isSaving: boolean;
  error: string | null;
  onSubmit: (payload: AlertTypeCreate | AlertTypeUpdate) => Promise<void>;
  onClose: () => void;
}) {
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [threshold, setThreshold] = useState(item?.default_threshold?.toString() ?? '');
  const [thresholdUnit, setThresholdUnit] = useState<ThresholdUnit | ''>(item?.threshold_unit ?? '');
  const [affectsFichaStatus, setAffectsFichaStatus] = useState(item?.affects_ficha_status ?? false);
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setCode(item?.code ?? '');
    setName(item?.name ?? '');
    setDescription(item?.description ?? '');
    setThreshold(item?.default_threshold?.toString() ?? '');
    setThresholdUnit(item?.threshold_unit ?? '');
    setAffectsFichaStatus(item?.affects_ficha_status ?? false);
    setIsActive(item?.is_active ?? true);
  }, [item]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || (!item && !code.trim())) {
      setValidationError('Completa los campos obligatorios.');
      return;
    }
    setValidationError(null);
    const parsedThreshold = threshold.trim() ? Number(threshold) : undefined;
    if (threshold.trim() && !Number.isFinite(parsedThreshold)) {
      setValidationError('El umbral debe ser un número válido.');
      return;
    }
    try {
      if (item) {
        await onSubmit({
          name: name.trim(),
          description: description.trim(),
          ...(parsedThreshold === undefined ? {} : { default_threshold: parsedThreshold }),
          ...(thresholdUnit ? { threshold_unit: thresholdUnit } : {}),
          affects_ficha_status: affectsFichaStatus,
          is_active: isActive,
        });
      } else {
        await onSubmit({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          ...(parsedThreshold === undefined ? {} : { default_threshold: parsedThreshold }),
          ...(thresholdUnit ? { threshold_unit: thresholdUnit } : {}),
          affects_ficha_status: affectsFichaStatus,
        });
      }
    } catch {
      // The hook exposes the API error in the form while keeping the modal open.
    }
  }

  return (
    <CatalogModal title={item ? 'Editar tipo de alerta' : 'Nuevo tipo de alerta'} onClose={onClose}>
      <form className={styles.modalBody} onSubmit={handleSubmit} noValidate>
        {error ? <div className={styles.formError} role="alert">{error}</div> : null}
        {validationError ? <div className={styles.formError} role="alert">{validationError}</div> : null}
        <label className={styles.field}>
          Código
          <input value={code} onChange={(event) => setCode(event.target.value)} disabled={Boolean(item)} required={!item} maxLength={50} />
        </label>
        <label className={styles.field}>
          Nombre
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
        </label>
        <label className={styles.field}>
          Umbral por defecto
          <input type="number" step="any" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
        </label>
        <label className={styles.field}>
          Unidad del umbral
          <select value={thresholdUnit} onChange={(event) => setThresholdUnit(event.target.value as ThresholdUnit | '')}>
            <option value="">Sin unidad</option>
            {THRESHOLD_UNITS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className={styles.checkboxField}>
          <input type="checkbox" checked={affectsFichaStatus} onChange={(event) => setAffectsFichaStatus(event.target.checked)} />
          Afecta el estado de la ficha
        </label>
        {item ? (
          <label className={styles.checkboxField}>
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            Activo
          </label>
        ) : null}
        <label className={`${styles.field} ${styles.fullField}`}>
          Descripción
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
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
