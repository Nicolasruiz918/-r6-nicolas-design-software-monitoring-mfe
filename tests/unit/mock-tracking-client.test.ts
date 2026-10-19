import { describe, expect, it } from 'vitest';

import { createMockTrackingClient } from '../../src/adapter/out/mock-tracking-client.js';
import type { CatalogPage } from '../../src/contracts/catalog-types.js';
import type { FichaTracking, TrackingSession } from '../../src/contracts/tracking-types.js';
import type { HttpRequest } from '../../src/application/ports/monitoring-catalogs.js';

describe('standalone ficha tracking mock client', () => {
  it('lists ficha trackings filtered by ficha and reads the detail', async () => {
    const client = createMockTrackingClient();
    const request = <TResponse>(input: HttpRequest) => client.request<TResponse>(input);

    const list = await request<CatalogPage<FichaTracking>>({ method: 'GET', path: '/api/v1/ficha-trackings', query: { ficha_id: 'ficha-demo-001' } });
    expect(list.data).toHaveLength(1);
    expect(list.data.every((item) => item.ficha_id === 'ficha-demo-001')).toBe(true);

    const detail = await request<FichaTracking>({ method: 'GET', path: `/api/v1/ficha-trackings/${list.data[0]?.id}` });
    expect(detail.id).toBe(list.data[0]?.id);
  });

  it('paginates sessions newest first (27 items, page_size 10)', async () => {
    const client = createMockTrackingClient();
    const base = '/api/v1/ficha-trackings/mock-tracking-1/tracking-sessions';

    const first = await client.request<CatalogPage<TrackingSession>>({
      method: 'GET',
      path: base,
      query: { page: 1, page_size: 10, sort: 'session_date:desc' },
    });
    expect(first.data).toHaveLength(10);
    expect(first.pagination).toMatchObject({ page: 1, page_size: 10, total_items: 27, total_pages: 3 });
    const dates = first.data.map((item) => item.session_date);
    expect([...dates].sort().reverse()).toEqual(dates);

    const last = await client.request<CatalogPage<TrackingSession>>({
      method: 'GET',
      path: base,
      query: { page: 3, page_size: 10, sort: 'session_date:desc' },
    });
    expect(last.data).toHaveLength(7);
  });

  it('creates and reads a session with a server-calculated attendance percentage', async () => {
    const client = createMockTrackingClient();
    const base = '/api/v1/ficha-trackings/mock-tracking-1/tracking-sessions';

    const created = await client.request<TrackingSession>({
      method: 'POST',
      path: base,
      body: { instructor_id: 'mock-instructor-1', session_date: '2026-10-01', session_type: 'PROJECT', attendance_count: 20, total_learners: 25, requires_follow_up: false },
    });
    expect(created.attendance_percentage).toBe(80);

    const detail = await client.request<TrackingSession>({ method: 'GET', path: `${base}/${created.id}` });
    expect(detail.session_type).toBe('PROJECT');
  });

  it('delegates catalog routes to the existing monitoring mock', async () => {
    const client = createMockTrackingClient();
    const riskLevels = await client.request<Array<{ code: string }>>({ method: 'GET', path: '/api/v1/risk-levels' });
    expect(riskLevels).toHaveLength(5);
  });
});