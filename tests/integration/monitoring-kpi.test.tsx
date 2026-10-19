import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MonitoringKpiPage } from '../../src/adapter/in/pages/MonitoringKpiPage.js';
import type { HttpClient, HttpRequest } from '../../src/application/ports/monitoring-catalogs.js';
import type { KpiSummaryReportEntry, KpiTracking } from '../../src/contracts/catalog-types.js';

const firstTracking: KpiTracking = {
  id: 'tracking-1', ficha_tracking_id: 'ficha-1', kpi_type_id: 'type-1', current_value: 78,
  threshold_value: 80, kpi_status_id: 'AT_RISK', period_start: '2026-09-01',
  period_end: '2026-09-30', measured_at: '2026-10-01T10:00:00Z',
};

const secondTracking: KpiTracking = {
  id: 'tracking-2', ficha_tracking_id: 'ficha-2', kpi_type_id: 'type-1', current_value: 91,
  threshold_value: 80, kpi_status_id: 'ON_TRACK', period_start: '2026-09-01',
  period_end: '2026-09-30', measured_at: '2026-10-01T11:00:00Z',
};

const summaryEntry: KpiSummaryReportEntry = {
  ficha_tracking_id: 'ficha-1', kpi_type_code: 'ATTENDANCE', kpi_type_name: 'Asistencia',
  current_value: 78, unit: 'PERCENTAGE', threshold_value: 80, kpi_status_code: 'AT_RISK',
  risk_level_code: 'MEDIUM', period_start: '2026-09-01', period_end: '2026-09-30',
  measured_at: '2026-10-01T10:00:00Z',
};

const catalogs = {
  kpiTypes: [{ id: 'type-1', code: 'ATTENDANCE', name: 'Asistencia', description: null, unit: 'PERCENTAGE' as const, is_active: true }],
  kpiStatuses: [{ id: 'status-1', code: 'AT_RISK', description: 'En riesgo', risk_level_id: 'risk-1' }],
};

function createClient(options: { hasMore?: boolean; summary?: KpiSummaryReportEntry[]; trackingStatus?: string; detailError?: boolean; detailDeferred?: boolean } = {}) {
  const requests: HttpRequest[] = [];
  let resolveDetail: (() => void) | undefined;
  const deferredDetail = new Promise<KpiTracking>((resolve) => { resolveDetail = () => resolve(firstTracking); });
  const request = vi.fn(async (input: HttpRequest) => {
    requests.push(input);
    if (input.path === '/api/v1/kpi-trackings' && input.method === 'GET') {
      if (input.query?.cursor === 'cursor-2') {
        return { data: [{ ...firstTracking, kpi_status_id: options.trackingStatus ?? firstTracking.kpi_status_id }, secondTracking], pagination: { next_cursor: null, limit: 50, has_more: false } };
      }
      return { data: [{ ...firstTracking, kpi_status_id: options.trackingStatus ?? firstTracking.kpi_status_id }], pagination: { next_cursor: options.hasMore === false ? null : 'cursor-2', limit: 50, has_more: options.hasMore !== false } };
    }
    if (input.path === '/api/v1/kpi-trackings/tracking-1' && input.method === 'GET') {
      if (options.detailDeferred) return deferredDetail;
      if (options.detailError) throw new Error('No fue posible consultar el detalle de la medición.');
      return firstTracking;
    }
    if (input.path === '/api/v1/kpi-trackings' && input.method === 'POST') {
      return { ...firstTracking, id: 'tracking-created', ...(input.body as object) };
    }
    if (input.path === '/api/v1/reports/kpi-summary' && input.method === 'GET') {
      const data = options.summary ?? [summaryEntry];
      return { data, pagination: { page: 1, page_size: 20, total_items: data.length, total_pages: 1 } };
    }
    if (input.path === '/api/v1/reports/indicators' && input.method === 'GET') {
      return { data: [{ kpi_status_code: 'AT_RISK', risk_level_code: 'MEDIUM', ficha_count: 1, avg_active_alert_count: 1, as_of: '2026-10-01T10:00:00Z' }], pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 } };
    }
    throw new Error(`Unexpected request: ${input.method} ${input.path}`);
  });
  return { client: { request } satisfies HttpClient, requests, resolveDetail: () => resolveDetail?.() };
}

describe('HU-006 KPI dashboard', () => {
  afterEach(() => cleanup());

  it('loads the next cursor page, preserves filters, appends unique rows and hides the control at the end', async () => {
    const { client, requests } = createClient();
    render(<MonitoringKpiPage httpClient={client} catalogs={catalogs} />);

    expect(await screen.findByText('ficha-1')).toBeTruthy();
    const firstRow = screen.getByText('ficha-1').closest('tr');
    expect(within(firstRow as HTMLElement).getByText('Asistencia')).toBeTruthy();
    expect(within(firstRow as HTMLElement).getByText('ATTENDANCE')).toBeTruthy();
    expect(within(firstRow as HTMLElement).queryByText('type-1')).toBeNull();
    fireEvent.change(screen.getByLabelText('Tipo KPI'), { target: { value: 'ATTENDANCE' } });
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'AT_RISK' } });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    await waitFor(() => expect(requests.filter((request) => request.path === '/api/v1/kpi-trackings' && !request.query?.cursor)).toHaveLength(2));
    const loadMore = await screen.findByRole('button', { name: 'Cargar más' });
    fireEvent.click(loadMore);

    await waitFor(() => expect(requests.some((request) => request.query?.cursor === 'cursor-2')).toBe(true));
    const cursorRequest = requests.find((request) => request.query?.cursor === 'cursor-2');
    expect(cursorRequest?.query).toMatchObject({ cursor: 'cursor-2', limit: 50, kpi_type: 'ATTENDANCE', kpi_status: 'AT_RISK', from: '2026-09-01', to: '2026-09-30' });
    expect(screen.getAllByText('ficha-1')).toHaveLength(1);
    expect(screen.getByText('ficha-2')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull());
  });

  it('does not show the load-more control when the first page has no more results', async () => {
    const { client } = createClient({ hasMore: false });
    render(<MonitoringKpiPage httpClient={client} catalogs={catalogs} />);

    expect(await screen.findByText('ficha-1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('renders the KPI summary as indicator cards instead of a table', async () => {
    const { client } = createClient();
    render(<MonitoringKpiPage httpClient={client} catalogs={catalogs} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }));

    expect(await screen.findByText('Resumen por ficha')).toBeTruthy();
    expect(await screen.findByText('Asistencia')).toBeTruthy();
    expect(screen.getByText('ficha-1')).toBeTruthy();
    expect(screen.getByText('78')).toBeTruthy();
    expect(screen.getByText('AT_RISK')).toBeTruthy();
    expect(screen.getByText('MEDIUM')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('maps the mock at-risk status to the warning style and keeps icon plus text', async () => {
    const { client } = createClient({ hasMore: false, trackingStatus: 'mock-status-at-risk' });
    render(<MonitoringKpiPage httpClient={client} catalogs={catalogs} />);

    const status = await screen.findByText('mock-status-at-risk');
    expect(status.parentElement?.className).toContain('warn');
    expect(status.parentElement?.textContent).toContain('!');
  });

  it('validates registration through the KPI form', async () => {
    const { client, requests } = createClient({ hasMore: false });
    render(<MonitoringKpiPage httpClient={client} catalogs={catalogs} />);
    await screen.findByText('ficha-1');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar medición' }));
    const modal = screen.getByRole('dialog', { name: 'Registrar medición KPI' });
    fireEvent.change(within(modal).getByLabelText('ID de ficha_tracking'), { target: { value: 'ficha-1' } });
    fireEvent.change(within(modal).getByLabelText('Tipo de KPI'), { target: { value: 'type-1' } });
    fireEvent.change(within(modal).getByLabelText('Valor actual'), { target: { value: '82' } });
    fireEvent.change(within(modal).getByLabelText('Valor umbral'), { target: { value: '80' } });
    fireEvent.change(within(modal).getByLabelText('Estado KPI'), { target: { value: 'status-1' } });
    fireEvent.change(within(modal).getByLabelText('Inicio del periodo'), { target: { value: '2026-10-01' } });
    fireEvent.change(within(modal).getByLabelText('Fin del periodo'), { target: { value: '2026-10-31' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(requests).toContainEqual(expect.objectContaining({ method: 'POST', path: '/api/v1/kpi-trackings', body: expect.objectContaining({ ficha_tracking_id: 'ficha-1', current_value: 82, threshold_value: 80, period_start: '2026-10-01', period_end: '2026-10-31' }) })));
  });

  it('shows detail loading and error feedback when opening a KPI detail', async () => {
    const deferred = createClient({ hasMore: false, detailDeferred: true });
    render(<MonitoringKpiPage httpClient={deferred.client} catalogs={catalogs} />);
    await screen.findByText('ficha-1');
    fireEvent.click(screen.getByText('ficha-1').closest('tr') as HTMLElement);
    expect(await screen.findByText('Cargando detalle…')).toBeTruthy();
    deferred.resolveDetail();
    const detailDialog = await screen.findByRole('dialog', { name: 'Detalle de medición' });
    expect(within(detailDialog).getByText('Asistencia')).toBeTruthy();
    expect(within(detailDialog).getByText('ATTENDANCE')).toBeTruthy();

    cleanup();
    const failed = createClient({ hasMore: false, detailError: true });
    render(<MonitoringKpiPage httpClient={failed.client} catalogs={catalogs} />);
    await screen.findByText('ficha-1');
    fireEvent.click(screen.getByText('ficha-1').closest('tr') as HTMLElement);
    expect((await screen.findByRole('alert')).textContent).toContain('No fue posible consultar el detalle');
    const errorDialog = screen.getByRole('dialog', { name: 'Detalle de medición' });
    fireEvent.click(within(errorDialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Detalle de medición' })).toBeNull());
  });

  it('loads and renders the Indicators tab from its report endpoint', async () => {
    const { client } = createClient({ hasMore: false });
    render(<MonitoringKpiPage httpClient={client} catalogs={catalogs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Indicadores' }));
    expect(await screen.findByText('Indicadores agregados')).toBeTruthy();
    expect(await screen.findByText('MEDIUM')).toBeTruthy();
    const indicatorRow = screen.getAllByRole('row')[1];
    expect(indicatorRow.textContent).toContain('1');
  });
});
