import { useCallback, useEffect, useState } from 'react';
import type { IndicatorsReportEntry, KpiSummaryReportEntry, Pagination } from '../../contracts/catalog-types.js';
import type { MonitoringPort, ReportParams } from '../ports/monitoring.js';

const messageOf = (error: unknown) => error instanceof Error ? error.message : 'No fue posible consultar el reporte.';

export function useKpiSummaryReport(api: MonitoringPort, enabled: boolean) {
  const [data, setData] = useState<KpiSummaryReportEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (params?: ReportParams) => {
    setIsLoading(true); setError(null);
    try { const page = await api.getKpiSummary(params); setData(page.data); setPagination(page.pagination); }
    catch (cause) { setError(messageOf(cause)); } finally { setIsLoading(false); }
  }, [api]);
  useEffect(() => { if (enabled) void load(); }, [enabled, load]);
  return { data, pagination, isLoading, error, load };
}
export function useIndicatorsReport(api: MonitoringPort, enabled: boolean) {
  const [data, setData] = useState<IndicatorsReportEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (params?: ReportParams) => {
    setIsLoading(true); setError(null);
    try { const page = await api.getIndicators(params); setData(page.data); setPagination(page.pagination); }
    catch (cause) { setError(messageOf(cause)); } finally { setIsLoading(false); }
  }, [api]);
  useEffect(() => { if (enabled) void load(); }, [enabled, load]);
  return { data, pagination, isLoading, error, load };
}


