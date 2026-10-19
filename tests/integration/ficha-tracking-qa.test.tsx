import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '../../src/App.js';
import { MON_TRACKING_SESSION_CREATE } from '../../src/contracts/remote-props.js';
import type { HttpClient, HttpRequest } from '../../src/application/ports/monitoring-catalogs.js';

const BASE = '/api/v1/ficha-trackings';
const SESSIONS = `${BASE}/tracking-1/tracking-sessions`;

const tracking = {
  id: 'tracking-1',
  ficha_id: 'ficha-1',
  assigned_instructor_id: 'instructor-1',
  overall_status_id: 'status-1',
  active_alert_count: 0,
  last_tracking_date: '2026-07-10',
  next_tracking_date: '2026-08-10',
  created_at: '2026-03-01T00:00:00Z',
};

const sessions = [
  {
    id: 'session-1',
    ficha_tracking_id: 'tracking-1',
    instructor_id: 'instructor-1',
    session_date: '2026-07-10',
    session_type: 'ACADEMIC' as const,
    attendance_count: 18,
    total_learners: 20,
    attendance_percentage: 90,
    curriculum_progress_percentage: 65,
    observations: 'Obs uno',
    requires_follow_up: false,
    created_at: '2026-07-10T10:00:00Z',
  },
  {
    id: 'session-2',
    ficha_tracking_id: 'tracking-1',
    instructor_id: 'instructor-1',
    session_date: '2026-06-10',
    session_type: 'WELLNESS' as const,
    attendance_count: 17,
    total_learners: 20,
    attendance_percentage: 85,
    curriculum_progress_percentage: 50,
    observations: 'Obs dos',
    requires_follow_up: false,
    created_at: '2026-06-10T10:00:00Z',
  },
];

const pagination = { page: 1, page_size: 10, total_items: 2, total_pages: 1 };

const AUTH_USER = { instructorId: 'instructor-auth', capabilities: [MON_TRACKING_SESSION_CREATE] };

function createClient(options: { sessionDetail?: (id: string) => Promise<unknown> } = {}) {
  const request = vi.fn(async (input: HttpRequest) => {
    const { method, path } = input;
    if (path === BASE && method === 'GET') return { data: [tracking], pagination: { ...pagination, total_items: 1 } };
    if (path === `${BASE}/tracking-1` && method === 'GET') return tracking;
    if (path === SESSIONS && method === 'GET') return { data: sessions, pagination };
    if (path === SESSIONS && method === 'POST') return { ...sessions[0], id: 'session-new', ...(input.body as object) };
    const detailMatch = /tracking-sessions\/([^/]+)$/.exec(path);
    if (detailMatch && method === 'GET') {
      const id = detailMatch[1] as string;
      return options.sessionDetail ? options.sessionDetail(id) : sessions.find((item) => item.id === id);
    }
    if (path.endsWith('/kpi-statuses')) return [{ id: 'status-1', code: 'AT_RISK', description: 'En riesgo', risk_level_id: 'risk-1' }];
    throw new Error(`Unexpected request: ${method} ${path}`);
  });
  return { client: { request } as unknown as HttpClient, request };
}

async function openTracking() {
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir seguimiento 1' }));
  expect(await screen.findByText('Académico')).toBeTruthy();
}

const registerButton = () => screen.getByRole('button', { name: '+ Registrar seguimiento' }) as HTMLButtonElement;
const sessionLink = (shortDate: string) => screen.getByRole('button', { name: `Ver detalle de la sesión del ${shortDate}` });

describe('HU-MON-007 devolucion de QA', () => {
  afterEach(() => cleanup());

  describe('1. identidad del instructor', () => {
    it('registra la sesion con el instructor autenticado, no con el asignado a la ficha', async () => {
      const { client, request } = createClient();
      render(<App httpClient={client} fichaId="ficha-1" user={AUTH_USER} />);
      await openTracking();

      fireEvent.click(registerButton());
      fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-05' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        path: SESSIONS,
        body: expect.objectContaining({ instructor_id: 'instructor-auth' }),
      })));
      expect(request).not.toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ instructor_id: 'instructor-1' }),
      }));
    });
  });

  describe('2. detalle de sesion', () => {
    it('abre el modal de inmediato con el estado de carga adentro y luego muestra el detalle', async () => {
      let resolveDetail!: (value: unknown) => void;
      const { client } = createClient({ sessionDetail: () => new Promise((resolve) => { resolveDetail = resolve; }) });
      render(<App httpClient={client} fichaId="ficha-1" user={AUTH_USER} />);
      await openTracking();

      fireEvent.click(sessionLink('10/07/2026'));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Cargando detalle de la sesión…')).toBeTruthy();

      await act(async () => { resolveDetail(sessions[0]); });
      expect(await within(dialog).findByText('Obs uno')).toBeTruthy();
      expect(within(dialog).queryByText('Cargando detalle de la sesión…')).toBeNull();
    });

    it('muestra el error dentro del modal', async () => {
      const { client } = createClient({ sessionDetail: () => Promise.reject(new Error('Sesión no disponible')) });
      render(<App httpClient={client} fichaId="ficha-1" user={AUTH_USER} />);
      await openTracking();

      fireEvent.click(sessionLink('10/07/2026'));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByText('No se pudo cargar la sesión.')).toBeTruthy();
      expect(within(dialog).getByText('Sesión no disponible')).toBeTruthy();
      expect(within(dialog).getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    });

    it('al cambiar de sesion no conserva el detalle anterior mientras carga el nuevo', async () => {
      const { client } = createClient({
        sessionDetail: (id) => (id === 'session-2' ? new Promise(() => undefined) : Promise.resolve(sessions[0])),
      });
      render(<App httpClient={client} fichaId="ficha-1" user={AUTH_USER} />);
      await openTracking();

      fireEvent.click(sessionLink('10/07/2026'));
      expect(await screen.findByText('Obs uno')).toBeTruthy();

      fireEvent.click(sessionLink('10/06/2026'));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByText('Cargando detalle de la sesión…')).toBeTruthy();
      expect(screen.queryByText('Obs uno')).toBeNull();
    });
  });

  describe('3. accesibilidad de modales', () => {
    it('mueve el foco al dialogo y lo devuelve al boton que lo abrio al cancelar', async () => {
      const { client } = createClient();
      render(<App httpClient={client} fichaId="ficha-1" user={AUTH_USER} />);
      await openTracking();

      const opener = registerButton();
      opener.focus();
      fireEvent.click(opener);

      const dialog = await screen.findByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(document.activeElement).toBe(opener));
    });
  });

  describe('4. permisos', () => {
    it('sin la capacidad MON_TRACKING_SESSION_CREATE deshabilita el registro y explica por que', async () => {
      const { client } = createClient();
      render(<App httpClient={client} fichaId="ficha-1" user={{ instructorId: 'instructor-auth', capabilities: [] }} />);
      await openTracking();

      expect(registerButton().disabled).toBe(true);
      expect(screen.getByText('No tienes permiso para registrar seguimientos.')).toBeTruthy();
    });

    it('si el shell no entrega user, falla cerrado (sin permiso)', async () => {
      const { client } = createClient();
      render(<App httpClient={client} fichaId="ficha-1" />);
      await openTracking();

      expect(registerButton().disabled).toBe(true);
      expect(screen.getByText('No tienes permiso para registrar seguimientos.')).toBeTruthy();
    });

    it('Coordinador (permiso sin instructorId): habilita el registro a nombre del instructor asignado y lo avisa', async () => {
      const { client, request } = createClient();
      render(<App httpClient={client} fichaId="ficha-1" user={{ capabilities: [MON_TRACKING_SESSION_CREATE] }} />);
      await openTracking();

      expect(registerButton().disabled).toBe(false);
      fireEvent.click(registerButton());
      expect(screen.getByText(/se registrará a nombre del instructor asignado/)).toBeTruthy();

      fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-05' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        path: SESSIONS,
        body: expect.objectContaining({ instructor_id: 'instructor-1' }),
      })));
    });

    it('Instructor: no muestra el aviso de registro a nombre de otro', async () => {
      const { client } = createClient();
      render(<App httpClient={client} fichaId="ficha-1" user={AUTH_USER} />);
      await openTracking();
      fireEvent.click(registerButton());
      expect(screen.queryByText(/se registrará a nombre del instructor asignado/)).toBeNull();
    });

    it('con permiso e instructor autenticado habilita el registro', async () => {
      const { client } = createClient();
      render(<App httpClient={client} fichaId="ficha-1" user={AUTH_USER} />);
      await openTracking();

      expect(registerButton().disabled).toBe(false);
      expect(screen.queryByText('No tienes permiso para registrar seguimientos.')).toBeNull();
    });
  });
});