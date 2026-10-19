import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '../../src/App.js';
import { createMockMonitoringClient } from '../../src/adapter/out/mock-monitoring-client.js';
import type { HttpClient, HttpRequest } from '../../src/application/ports/monitoring-catalogs.js';

const kpiPage = {
  data: [{ id: 'kpi-1', code: 'ATTENDANCE', name: 'Asistencia', description: null, unit: 'PERCENTAGE' as const, is_active: true }],
  pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 },
};

const alertPage = {
  data: [{ id: 'alert-1', code: 'LOW_ATTENDANCE', name: 'Baja asistencia', description: null, default_threshold: 80, threshold_unit: 'PERCENTAGE' as const, affects_ficha_status: true, is_active: true }],
  pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 },
};

function createClient() {
  const requests: HttpRequest[] = [];
  const request = vi.fn(async (input: HttpRequest) => {
    requests.push(input);
    if (input.path.endsWith('/kpi-types') && input.method === 'GET') return kpiPage;
    if (input.path.endsWith('/alert-types') && input.method === 'GET') return alertPage;
    if (input.path.endsWith('/risk-levels')) return [{ id: 'risk-1', code: 'LOW', label: 'Bajo', color_hex: '#1B9E4B', priority_order: 4 }];
    if (input.path.endsWith('/kpi-statuses')) return [{ id: 'status-1', code: 'ON_TRACK', description: 'En seguimiento', risk_level_id: 'risk-1' }];
    if (input.method === 'POST') return { id: 'created', ...(input.body as object) };
    if (input.method === 'PUT') return { id: 'updated', ...(input.body as object) };
    throw new Error(`Unexpected request: ${input.method} ${input.path}`);
  });
  return { client: { request } satisfies HttpClient, request, requests };
}

describe('HU-005 monitoring catalogs', () => {
  afterEach(() => cleanup());

  it('loads the four independent catalog resources and exposes read-only tabs without mutations', async () => {
    const { client, requests } = createClient();
    render(<App httpClient={client} />);

    expect(await screen.findByText('ATTENDANCE')).toBeTruthy();
    await waitFor(() => expect(requests.filter((request) => request.method === 'GET')).toHaveLength(4));

    fireEvent.click(screen.getByRole('tab', { name: 'Niveles de riesgo' }));
    expect(await screen.findByText('Bajo')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Nuevo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Estados de KPI' }));
    expect(await screen.findByText('ON_TRACK')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Nuevo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
  });

  it('creates a KPI type through POST and edits an alert type through PUT', async () => {
    const { client, request } = createClient();
    render(<App httpClient={client} />);
    expect(await screen.findByText('ATTENDANCE')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo tipo de KPI' }));
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'CURRICULUM_PROGRESS' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Avance curricular' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      path: '/api/v1/kpi-types',
      body: { code: 'CURRICULUM_PROGRESS', name: 'Avance curricular', unit: 'PERCENTAGE' },
    })));

    fireEvent.click(screen.getByRole('tab', { name: 'Tipos de alerta' }));
    expect(await screen.findByText('LOW_ATTENDANCE')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Asistencia insuficiente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'PUT',
      path: '/api/v1/alert-types/alert-1',
      body: expect.objectContaining({ name: 'Asistencia insuficiente' }),
    })));
  });

  it('supports the standalone demo flow with the in-memory client', async () => {
    render(<App httpClient={createMockMonitoringClient()} />);

    expect(await screen.findByText('ATTENDANCE')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Tipos de alerta' }));
    expect(await screen.findByText('LOW_ATTENDANCE')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Niveles de riesgo' }));
    expect(await screen.findByText('Crítico')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Estados de KPI' }));
    expect(await screen.findByText('ON_TRACK')).toBeTruthy();
  });
});
