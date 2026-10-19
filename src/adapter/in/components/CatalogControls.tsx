import type { Pagination } from '../../../contracts/catalog-types.js';
import styles from '../../../App.module.css';

export function LoadingState({ label }: { label: string }) {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span>Cargando {label}…</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={`${styles.state} ${styles.errorState}`} role="alert">
      <strong>No se pudo cargar el catálogo</strong>
      <span>{message}</span>
      <button className={styles.secondaryButton} type="button" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <p className={styles.emptyState}>No hay {label} registrados.</p>;
}

export function PaginationControls({
  pagination,
  onPageChange,
}: {
  pagination: Pagination | null;
  onPageChange: (page: number) => void;
}) {
  if (!pagination || pagination.total_items === 0) return null;

  const start = (pagination.page - 1) * pagination.page_size + 1;
  const end = Math.min(pagination.page * pagination.page_size, pagination.total_items);

  return (
    <nav className={styles.pagination} aria-label="Paginación del catálogo">
      <span>
        Mostrando {start}–{end} de {pagination.total_items}
      </span>
      <div className={styles.paginationActions}>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          Anterior
        </button>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={pagination.page >= pagination.total_pages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Siguiente
        </button>
      </div>
    </nav>
  );
}

export function BooleanBadge({ value }: { value: boolean }) {
  return (
    <span className={`${styles.badge} ${value ? styles.successBadge : styles.neutralBadge}`}>
      <span className={styles.badgeIcon} aria-hidden="true">●</span>
      {value ? 'Activo' : 'Inactivo'}
    </span>
  );
}
