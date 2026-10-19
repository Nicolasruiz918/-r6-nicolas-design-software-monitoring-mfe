import { describe, expect, it } from 'vitest';

import { createMonitoringApi } from '../../src/infrastructure/monitoring-api.js';
import type { HttpClient, HttpRequest } from '../../src/application/ports/monitoring.js';

describe('HU-006 KPI API adapter', () => {
  it('maps KPI collections, recording, detail and reports to the OpenAPI contract', async () => {
    const requests: HttpRequest[] = [];
    const client: HttpClient = {
      request: async <T>(request: HttpRequest) => {
        requests.push(request);
        return {} as T;
      },
    };
    const api = createMonitoringApi(client);

    await api.listKpiTrackings({
      fichaTrackingId: 'ficha-1',
      kpiType: 'ATTENDANCE',
      kpiStatus: 'AT_RISK',
      from: '2026-01-01',
      to: '2026-02-01',
    });
    await api.createKpiTracking({ ficha_tracking_id: 'ficha-1' });
    await api.getKpiTracking('kpi-1');
    await api.getKpiSummary({ page: 1, pageSize: 20, kpiType: 'ATTENDANCE' });
    await api.getIndicators({ page: 1, pageSize: 20, status: 'AT_RISK' });

    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /api/v1/kpi-trackings',
      'POST /api/v1/kpi-trackings',
      'GET /api/v1/kpi-trackings/kpi-1',
      'GET /api/v1/reports/kpi-summary',
      'GET /api/v1/reports/indicators',
    ]);
    expect(requests[0].query).toMatchObject({
      ficha_tracking_id: 'ficha-1',
      kpi_type: 'ATTENDANCE',
      kpi_status: 'AT_RISK',
    });
    expect(requests[1].body).toEqual({ ficha_tracking_id: 'ficha-1' });
  });
});
