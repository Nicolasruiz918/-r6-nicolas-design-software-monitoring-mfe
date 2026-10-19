import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useGeneratedAlerts } from '../../src/application/hooks/useGeneratedAlerts.js';
import type { AlertsPlansPort, GeneratedAlertPage } from '../../src/application/ports/alerts-plans.js';
import type { GeneratedAlert } from '../../src/contracts/alerts-plans-types.js';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function makeAlert(id: string): GeneratedAlert {
  return {
    id,
    ficha_tracking_id: 'ft-1',
    alert_type_id: 'type-1',
    risk_level_id: 'risk-1',
    source_event_id: 'event-1',
    description: `Alerta ${id}`,
    is_resolved: false,
    generated_at: '2026-07-08T09:00:00Z',
  };
}

const pageOf = (id: string): GeneratedAlertPage => ({
  data: [makeAlert(id)],
  pagination: { next_cursor: null, limit: 50, has_more: false },
});

function setup() {
  const queue: Array<Deferred<GeneratedAlertPage>> = [];
  const port: AlertsPlansPort = {
    listGeneratedAlerts: vi.fn(() => {
      const entry = deferred<GeneratedAlertPage>();
      queue.push(entry);
      return entry.promise;
    }),
    resolveGeneratedAlert: vi.fn(),
    listImprovementPlans: vi.fn(),
    createImprovementPlan: vi.fn(),
  };
  const hook = renderHook(() => useGeneratedAlerts(port));
  return { ...hook, queue, port };
}

describe('useGeneratedAlerts', () => {
  afterEach(() => cleanup());

  it('una respuesta antigua que llega tarde no sobrescribe la lista mas reciente', async () => {
    const { result, queue } = setup();
    await waitFor(() => expect(queue).toHaveLength(1));

    act(() => { void result.current.load({ riskLevel: 'HIGH' }); });
    await waitFor(() => expect(queue).toHaveLength(2));

    const [first, second] = queue;
    await act(async () => {
      second?.resolve(pageOf('new'));
      first?.resolve(pageOf('old'));
    });

    expect(result.current.data.map((item) => item.id)).toEqual(['new']);
    expect(result.current.isLoading).toBe(false);
  });

  it('resolve llama al puerto con PUT y refresca la lista', async () => {
    const { result, queue, port } = setup();
    await waitFor(() => expect(queue).toHaveLength(1));
    await act(async () => { queue[0]?.resolve(pageOf('a')); });

    vi.mocked(port.resolveGeneratedAlert).mockResolvedValue({ ...makeAlert('a'), is_resolved: true });
    await act(async () => { await result.current.resolve('a', { resolution_notes: 'ok' }); });

    expect(port.resolveGeneratedAlert).toHaveBeenCalledWith('a', { resolution_notes: 'ok' });
    await waitFor(() => expect(queue).toHaveLength(2));
  });
});