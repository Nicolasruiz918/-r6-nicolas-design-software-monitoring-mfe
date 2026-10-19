import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '../../src/App.js';
import type { HttpClient, HttpRequest } from '../../src/application/ports/monitoring-catalogs.js';

const BASE = '/api/v1/ficha-trackings';
const SESSIONS = `${BASE}/tracking-1/tracking-sessions`;

const tracking = {
  id: 'tracking-1',
  ficha_id: 'ficha-1',
  assigned_instructor_id: 'instructor-1',
  overall_status_id: 'status-1',
  active_alert_count: 2,
  last_tracking_date: '2026-07-10',
  next_tracking_date: '2026-08-10',
  created_at: '2026-03-01T00:00:00Z',
};

const session = {
  id: 'session-1',
  ficha_tracking_id: 'tracking-1',
  instructor_id: 'instructor-1',
  session_date: '2026-07-10',
  session_type: 'ACADEMIC' as const,
  attendance_count: 18,
  total_learners: 20,
  attendance_percentage: 90,
  curriculum_progress_percentage: 65,
  observations: 'Primera sesión',
  requires_follow_up: true,
  created_at: '2026-07-10T10:00:00Z',
};

const pagination = { page: 1, page_size: 10, total_items: 1, total_pages: 1 };

/** Usuario autenticado que entrega el shell (instructor con permiso de registro). */
const USER = { instructorId: 'instructor-1', capabilities: ['MON_TRACKING_SESSION_CREATE'] };

function createClient(options: { empty?: boolean; failListOnce?: boolean; failPost?: boolean } = {}) {
  let listFailed = false;
  const request = vi.fn(async (input: HttpRequest) => {
    const { method, path, query } = input;
    if (path === BASE && method === 'GET') {
      if (options.failListOnce && !listFailed) {
        listFailed = true;
        throw new Error('Servicio no disponible');
      }
      if (options.empty || query?.ficha_id === 'ficha-2') {
        return { data: [], pagination: { ...pagination, total_items: 0 } };
      }
      return { data: [tracking], pagination };
    }
    if (path === `${BASE}/tracking-1` && method === 'GET') return tracking;
    if (path === SESSIONS && method === 'GET') return { data: [session], pagination };
    if (path === SESSIONS && method === 'POST') {
      if (options.failPost) throw new Error('No se pudo guardar la sesión');
      return { ...session, id: 'session-new', ...(input.body as object) };
    }
    if (path === `${SESSIONS}/session-1` && method === 'GET') return session;
    if (path.endsWith('/kpi-statuses')) return [{ id: 'status-1', code: 'AT_RISK', description: 'En riesgo', risk_level_id: 'risk-1' }];
    throw new Error(`Unexpected request: ${method} ${path}`);
  });
  return { client: { request } satisfies HttpClient, request };
}

async function openTracking() {
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir seguimiento 1' }));
  expect(await screen.findByText('Académico')).toBeTruthy();
}

function callsTo(request: ReturnType<typeof vi.fn>, method: string, path: string) {
  return request.mock.calls.filter(([req]) => (req as HttpRequest).method === method && (req as HttpRequest).path === path);
}

describe('HU-MON-007 seguimiento de ficha', () => {
  afterEach(() => cleanup());

  it('E1: lista los seguimientos de la ficha filtrando por ficha_id y NO consulta el detalle sin click', async () => {
    const { client, request } = createClient();
    render(<App httpClient={client} fichaId="ficha-1" user={USER} />);

    expect(await screen.findByRole('button', { name: 'Abrir seguimiento 1' })).toBeTruthy();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: BASE,
      query: expect.objectContaining({ ficha_id: 'ficha-1' }),
    }));
    expect(callsTo(request, 'GET', `${BASE}/tracking-1`)).toHaveLength(0);
    expect(callsTo(request, 'GET', SESSIONS)).toHaveLength(0);
    expect(screen.getByText('Selecciona un seguimiento para ver sus sesiones.')).toBeTruthy();
  });

  it('E3/E4: click en la fila consulta GET /ficha-trackings/{id} y luego sus sesiones (mas reciente primero)', async () => {
    const { client, request } = createClient();
    render(<App httpClient={client} fichaId="ficha-1" user={USER} />);
    await openTracking();

    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', path: `${BASE}/tracking-1` }));
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: SESSIONS,
      query: expect.objectContaining({ page: 1, page_size: 10, sort: 'session_date:desc' }),
    }));
    expect(screen.getByText('18/20 · 90%')).toBeTruthy();
    expect(screen.getByText('Mostrando 1–1 de 1')).toBeTruthy();
    expect((await screen.findAllByText('En riesgo')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('10 jul 2026').length).toBeGreaterThan(0);
  });

  it('E5: registra una sesion con POST .../tracking-sessions y nunca hace POST /ficha-trackings', async () => {
    const { client, request } = createClient();
    render(<App httpClient={client} fichaId="ficha-1" user={USER} />);
    await openTracking();

    fireEvent.click(screen.getByRole('button', { name: '+ Registrar seguimiento' }));
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      path: SESSIONS,
      body: expect.objectContaining({
        instructor_id: 'instructor-1',
        session_date: '2026-10-05',
        session_type: 'ACADEMIC',
        requires_follow_up: false,
      }),
    })));
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', path: BASE }));
    expect(await screen.findByText('Seguimiento registrado.')).toBeTruthy();
  });

  it('recarga la tabla de sesiones despues de crear una', async () => {
    const { client, request } = createClient();
    render(<App httpClient={client} fichaId="ficha-1" user={USER} />);
    await openTracking();
    expect(callsTo(request, 'GET', SESSIONS)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '+ Registrar seguimiento' }));
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(callsTo(request, 'GET', SESSIONS)).toHaveLength(2));
  });

  it('si el POST falla, el modal sigue abierto y muestra el error de la API', async () => {
    const { client } = createClient({ failPost: true });
    render(<App httpClient={client} fichaId="ficha-1" user={USER} />);
    await openTracking();

    fireEvent.click(screen.getByRole('button', { name: '+ Registrar seguimiento' }));
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('No se pudo guardar la sesión')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText('Seguimiento registrado.')).toBeNull();
  });

  it('valida en linea que los asistentes no superen el total y no envia el formulario', async () => {
    const { client, request } = createClient();
    render(<App httpClient={client} fichaId="ficha-1" user={USER} />);
    await openTracking();

    fireEvent.click(screen.getByRole('button', { name: '+ Registrar seguimiento' }));
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText('Asistentes'), { target: { value: '21' } });
    fireEvent.change(screen.getByLabelText('Total de aprendices'), { target: { value: '20' } });

    expect(await screen.findByText(/Los asistentes no pueden superar el total de aprendices/)).toBeTruthy();
    expect(screen.getByText('→ 105% de asistencia')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
  });

  it('E5: abre el detalle de una sesion con GET .../tracking-sessions/{session_id}', async () => {
    const { client, request } = createClient();
    render(<App httpClient={client} fichaId="ficha-1" user={USER} />);
    await openTracking();

    fireEvent.click(screen.getByText('Académico'));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: `${SESSIONS}/session-1`,
    })));
  });

  it('muestra el estado vacio cuando la ficha no tiene seguimiento', async () => {
    const { client } = createClient({ empty: true });
    render(<App httpClient={client} fichaId="ficha-1" user={USER} />);

    expect(await screen.findByText('Esta ficha aún no tiene registros de seguimiento.')).toBeTruthy();
    expect((screen.getByRole('button', { name: '+ Registrar seguimiento' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('error de API en el listado: muestra el mensaje y permite reintentar', async () => {
    const { client } = createClient({ failListOnce: true });
    render(<App httpClient={client} fichaId="ficha-1" user={USER} />);

    expect(await screen.findByText('Servicio no disponible')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('button', { name: 'Abrir seguimiento 1' })).toBeTruthy();
  });

  it('modo independiente: al cambiar de ficha vuelve a consultar con el nuevo ficha_id', async () => {
    const { client, request } = createClient();
    render(
      <App
        httpClient={client}
        fichaOptions={[
          { id: 'ficha-1', label: 'Ficha 1' },
          { id: 'ficha-2', label: 'Ficha 2' },
        ]}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Abrir seguimiento 1' })).toBeTruthy();

    const selector = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: 'ficha-2' } });

    expect(await screen.findByText('Esta ficha aún no tiene registros de seguimiento.')).toBeTruthy();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path: BASE,
      query: expect.objectContaining({ ficha_id: 'ficha-2' }),
    }));
  });
});