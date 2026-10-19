const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function parseDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return { year: match[1] as string, month: Number(match[2]), day: match[3] as string };
}

/** 2026-07-10 -> 10/07/2026 (tabla del prototipo) */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parts = parseDate(iso);
  return parts ? `${parts.day}/${String(parts.month).padStart(2, '0')}/${parts.year}` : iso;
}

/** 2026-07-10 -> 10 jul 2026 (tarjetas de resumen del prototipo) */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parts = parseDate(iso);
  return parts ? `${Number(parts.day)} ${MONTHS[parts.month - 1] ?? ''} ${parts.year}` : iso;
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Number(value.toFixed(2))}%`;
}

/** 18/20 · 90% */
export function formatAttendance(
  count: number | null | undefined,
  total: number | null | undefined,
  percentage: number | null | undefined,
): string {
  if (count === null || count === undefined || total === null || total === undefined) {
    return percentage === null || percentage === undefined ? '—' : formatPercent(percentage);
  }
  const pct = percentage === null || percentage === undefined ? '' : ` · ${formatPercent(percentage)}`;
  return `${count}/${total}${pct}`;
}

function toUtcMs(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}

/** Seguimiento pendiente: proximo vencido o mas de 35 dias sin registrar (RF-MON-01). */
export function isTrackingOverdue(
  lastDate: string | null | undefined,
  nextDate: string | null | undefined,
  today: Date = new Date(),
): boolean {
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (nextDate && toUtcMs(nextDate) < todayMs) return true;
  if (lastDate && (todayMs - toUtcMs(lastDate)) / 86_400_000 > 35) return true;
  return false;
}