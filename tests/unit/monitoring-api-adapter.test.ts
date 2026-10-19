import { describe, expect, it, vi } from 'vitest';

import { MonitoringApiAdapter } from '../../src/adapter/out/monitoring-api-adapter.js';
import type { HttpClient } from '../../src/application/ports/monitoring-catalogs.js';

describe('MonitoringApiAdapter', () => {
  it('maps the KPI catalog collection to the contract endpoint and query', async () => {
    const request = vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 0 } });
    const api = new MonitoringApiAdapter({ request } satisfies HttpClient);

    await api.listKpiTypes({ page: 2, pageSize: 10, code: 'ATTENDANCE', isActive: true });

    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/v1/kpi-types',
      query: { page: 2, page_size: 10, code: 'ATTENDANCE', is_active: true },
    });
  });

  it('uses POST for creation and PUT for KPI updates', async () => {
    const request = vi.fn().mockResolvedValue({});
    const api = new MonitoringApiAdapter({ request } satisfies HttpClient);

    await api.createKpiType({ code: 'ATTENDANCE', name: 'Asistencia', unit: 'PERCENTAGE' });
    await api.updateKpiType('kpi/1', { name: 'Asistencia actualizada', is_active: false });

    expect(request).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      path: '/api/v1/kpi-types',
      body: { code: 'ATTENDANCE', name: 'Asistencia', unit: 'PERCENTAGE' },
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      method: 'PUT',
      path: '/api/v1/kpi-types/kpi%2F1',
      body: { name: 'Asistencia actualizada', is_active: false },
    });
  });

  it('keeps risk levels and KPI statuses read-only GET resources', async () => {
    const request = vi.fn().mockResolvedValue([]);
    const api = new MonitoringApiAdapter({ request } satisfies HttpClient);

    await api.listRiskLevels();
    await api.listKpiStatuses();

    expect(request).toHaveBeenNthCalledWith(1, { method: 'GET', path: '/api/v1/risk-levels' });
    expect(request).toHaveBeenNthCalledWith(2, { method: 'GET', path: '/api/v1/kpi-statuses' });
  });
});
