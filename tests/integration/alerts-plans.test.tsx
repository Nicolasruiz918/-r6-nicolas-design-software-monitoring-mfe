import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AlertsPlansPage } from '../../src/adapter/in/pages/AlertsPlansPage.js';
import { AlertsPlansApiAdapter } from '../../src/adapter/out/alerts-plans-api-adapter.js';
import { MonitoringApiAdapter } from '../../src/adapter/out/monitoring-api-adapter.js';
import type { HttpClient, HttpRequest } from '../../src/application/ports/monitoring-catalogs.js';
import { MON_ALERT_RESOLVE, MON_IMPROVEMENT_PLAN_MANAGE } from '../../src/contracts/remote-props.js';

const ALERTS = '/api/v1/generated-alerts';
const PLANS = '/api/v1/improvement-plans';
const pageInfo = { page: 1, page_size: 20, total_items: 1, total_pages: 1 };

const pendingAlert = {
  id: 'alert-1',
  ficha_tracking_id: 'ft-1',
  alert_type_id: 'type-1',
  risk_level_id: 'risk-high',
  source_event_id: 'event-1',
  description: 'La asistencia cayó al 70 por ciento',
  is_resolved: false,
  generated_at: '2026-07-08T09:00:00Z',
};

const resolvedAlert = {
  ...pendingAlert,
  id: 'alert-2',
  description: 'Avance curricular bajo el umbral',
  is_resolved: true,
  resolved_at: '2026-07-09T09:00:00Z',
};

const plan = {
  id: 'plan-1',
  ficha_tracking_id: 'ft-1',
  generated_alert_id: 'alert-2',
  title: 'Plan de nivelación',
  description: 'Reforzar unidades',
  specific_actions: 'Sesiones semanales',
  due_date: '2026-12-01',
  status: 'IN_PROGRESS' as const,
  created_by: 'user-1',
  created_at: '2026-07-10T10:00:00Z',
};

const USER = { instructorId: 'instructor-1', capabilities: [MON_ALERT_RESOLVE, MON_IMPROVEMENT_PLAN_MANAGE] };

function createClient(options: { failListOnce?: boolean; failResolve?: boolean } = {}) {
  let listFailed = false;
  const request = vi.fn(async (input: HttpRequest) => {
    const { method, path } = input;
    if (path === ALERTS && method === 'GET') {
      if (options.failListOnce && !listFailed) {
        listFailed = true;
        throw new Error('Servicio no disponible');
      }
      return { data: [pendingAlert, resolvedAlert], pagination: { next_cursor: null, limit: 50, has_more: false } };
    }
    if (path === `${ALERTS}/alert-1/resolve` && method === 'PUT') {
      if (options.failResolve) throw new Error('La alerta ya está resuelta.');
      return { ...pendingAlert, is_resolved: true };
    }
    if (path === PLANS && method === 'GET') return { data: [plan], pagination: pageInfo };
    if (path === PLANS && method === 'POST') return { ...plan, id: 'plan-new', ...(input.body as object) };
    if (path === '/api/v1/risk-levels') return [{ id: 'risk-high', code: 'HIGH', label: 'Alto', color_hex: '#F04438', priority_order: 2 }];
    if (path === '/api/v1/alert-types') {
      return {
        data: [{ id: 'type-1', code: 'LOW_ATTENDANCE', name: 'Baja asistencia', description: null, default_threshold: 80, threshold_unit: 'PERCENTAGE', affects_ficha_status: true, is_active: true }],
        pagination: pageInfo,
      };
    }
    throw new Error(`Unexpected request: ${method} ${path}`);
  });
  return { client: { request } satisfies HttpClient, request };
}

function renderPage(client: HttpClient, user: typeof USER | { capabilities: string[] } | null = USER) {
  return render(
    <AlertsPlansPage
      alertsApi={new AlertsPlansApiAdapter(client)}
      catalogApi={new MonitoringApiAdapter(client)}
      {...(user ? { user } : {})}
    />,
  );
}

describe('HU-MON-008 alertas generadas y planes de mejoramiento', () => {
  afterEach(() => cleanup());

  it('E1: lista GET /generated-alerts y clasifica con los catalogos risk-levels y alert-types', async () => {
    const { client, request } = createClient();
    renderPage(client);

    const row = (await screen.findByText('La asistencia cayó al 70 por ciento')).closest('tr') as HTMLElement;
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: ALERTS,
      query: expect.objectContaining({ limit: 50 }),
    }));
    await waitFor(() => expect(within(row).getByText('Alto')).toBeTruthy());
    expect(within(row).getByText('Baja asistencia')).toBeTruthy();
    expect(within(row).getByText('Pendiente')).toBeTruthy();
  });

  it('E1: filtrar por nivel de riesgo vuelve a consultar con risk_level', async () => {
    const { client, request } = createClient();
    renderPage(client);
    await screen.findByText('La asistencia cayó al 70 por ciento');
    await screen.findByRole('option', { name: 'Alto' });

    fireEvent.change(screen.getByLabelText('Nivel de riesgo'), { target: { value: 'HIGH' } });

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: ALERTS,
      query: expect.objectContaining({ risk_level: 'HIGH' }),
    })));
  });

  it('E1: error de API en el listado muestra el mensaje y permite reintentar', async () => {
    const { client } = createClient({ failListOnce: true });
    renderPage(client);

    expect(await screen.findByText('Servicio no disponible')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('La asistencia cayó al 70 por ciento')).toBeTruthy();
  });

  it('E2: exige notas, confirma y resuelve con PUT .../resolve (nunca POST)', async () => {
    const { client, request } = createClient();
    renderPage(client);
    await screen.findByText('La asistencia cayó al 70 por ciento');

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como atendida' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText(/Las notas de resolución son obligatorias/)).toBeTruthy();
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT' }));

    fireEvent.change(screen.getByLabelText(/^Notas de resolución/), { target: { value: 'Se contactó al instructor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'PUT',
      path: `${ALERTS}/alert-1/resolve`,
      body: { resolution_notes: 'Se contactó al instructor' },
    })));
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', path: `${ALERTS}/alert-1/resolve` }));
    expect(await screen.findByText('Alerta resuelta.')).toBeTruthy();
  });

  it('E2: si la API falla, el modal sigue abierto y muestra el error', async () => {
    const { client } = createClient({ failResolve: true });
    renderPage(client);
    await screen.findByText('La asistencia cayó al 70 por ciento');

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como atendida' }));
    fireEvent.change(screen.getByLabelText(/^Notas de resolución/), { target: { value: 'Notas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('La alerta ya está resuelta.')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText('Alerta resuelta.')).toBeNull();
  });

  it('permisos: sin MON_ALERT_RESOLVE deshabilita la accion y explica por que', async () => {
    const { client } = createClient();
    renderPage(client, { capabilities: [] });
    await screen.findByText('La asistencia cayó al 70 por ciento');

    expect((screen.getByRole('button', { name: 'Marcar como atendida' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Crear plan' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('No tienes permiso para resolver alertas.')).toBeTruthy();
  });

  it('permisos: si el shell no entrega user, falla cerrado', async () => {
    const { client } = createClient();
    renderPage(client, null);
    await screen.findByText('La asistencia cayó al 70 por ciento');

    expect((screen.getByRole('button', { name: 'Marcar como atendida' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('E3: la pestaña de planes consulta GET /improvement-plans y filtra por status', async () => {
    const { client, request } = createClient();
    renderPage(client);

    fireEvent.click(screen.getByRole('tab', { name: 'Planes de mejoramiento' }));
    expect(await screen.findByText('Plan de nivelación')).toBeTruthy();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', path: PLANS }));

    fireEvent.change(screen.getByLabelText('Estado del plan'), { target: { value: 'PENDING' } });
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: PLANS,
      query: expect.objectContaining({ status: 'PENDING' }),
    })));
  });

  it('E4: crea un plan a partir de una alerta resuelta con POST /improvement-plans', async () => {
    const { client, request } = createClient();
    renderPage(client);
    await screen.findByText('Avance curricular bajo el umbral');

    fireEvent.click(screen.getByRole('button', { name: 'Crear plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/El título es obligatorio/)).toBeTruthy();
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', path: PLANS }));

    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Plan de refuerzo' } });
    fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: 'Reforzar unidad 3' } });
    fireEvent.change(screen.getByLabelText(/^Acciones específicas/), { target: { value: 'Tutorías semanales' } });
    fireEvent.change(screen.getByLabelText(/^Fecha límite/), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      path: PLANS,
      body: {
        ficha_tracking_id: 'ft-1',
        generated_alert_id: 'alert-2',
        title: 'Plan de refuerzo',
        description: 'Reforzar unidad 3',
        specific_actions: 'Tutorías semanales',
        due_date: '2026-12-01',
      },
    })));
    expect(await screen.findByText('Plan de mejoramiento creado.')).toBeTruthy();
  });
});