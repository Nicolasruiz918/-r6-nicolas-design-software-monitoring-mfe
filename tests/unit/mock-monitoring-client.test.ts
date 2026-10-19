import { describe, expect, it } from 'vitest';

import { createMockMonitoringClient } from '../../src/adapter/out/mock-monitoring-client.js';
import type { HttpRequest } from '../../src/application/ports/monitoring-catalogs.js';

describe('standalone monitoring mock client', () => {
  it('serves all four catalog resources and keeps mutations in memory', async () => {
    const client = createMockMonitoringClient();
    const request = <TResponse>(input: HttpRequest) => client.request<TResponse>(input);

    const kpiTypes = await request<{ data: Array<{ code: string }>; pagination: { total_items: number } }>({ method: 'GET', path: '/api/v1/kpi-types', query: { page: 1, page_size: 20 } });
    const alertTypes = await request<{ data: Array<{ code: string }>; pagination: { total_items: number } }>({ method: 'GET', path: '/api/v1/alert-types', query: { page: 1, page_size: 20 } });
    const riskLevels = await request<Array<{ code: string }>>({ method: 'GET', path: '/api/v1/risk-levels' });
    const kpiStatuses = await request<Array<{ code: string }>>({ method: 'GET', path: '/api/v1/kpi-statuses' });

    expect(kpiTypes.data.map((item) => item.code)).toContain('ATTENDANCE');
    expect(alertTypes.data.map((item) => item.code)).toContain('LOW_ATTENDANCE');
    expect(kpiTypes.pagination.total_items).toBeGreaterThan(0);
    expect(alertTypes.pagination.total_items).toBeGreaterThan(0);
    expect(riskLevels).toHaveLength(5);
    expect(kpiStatuses).toHaveLength(4);

    await request({ method: 'POST', path: '/api/v1/kpi-types', body: { code: 'DEMO_KPI', name: 'KPI demo', unit: 'COUNT' } });
    const filtered = await request<{ data: Array<{ code: string }> }>({ method: 'GET', path: '/api/v1/kpi-types', query: { code: 'DEMO_KPI' } });
    expect(filtered.data).toEqual([expect.objectContaining({ code: 'DEMO_KPI', is_active: true })]);

    await request({ method: 'PUT', path: '/api/v1/kpi-types/mock-kpi-attendance', body: { name: 'Asistencia actualizada', is_active: false } });
    const updated = await request<{ data: Array<{ name: string; is_active: boolean }> }>({ method: 'GET', path: '/api/v1/kpi-types', query: { code: 'ATTENDANCE' } });
    expect(updated.data).toEqual([expect.objectContaining({ name: 'Asistencia actualizada', is_active: false })]);
  });
});
