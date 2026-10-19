import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTrackingSessions } from '../../src/application/hooks/useTrackingSessions.js';
import type { FichaTrackingPort } from '../../src/application/ports/ficha-tracking.js';
import type { TrackingSession } from '../../src/contracts/tracking-types.js';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeSession(id: string): TrackingSession {
  return {
    id,
    ficha_tracking_id: 'tracking-1',
    instructor_id: 'instructor-1',
    session_date: '2026-07-10',
    session_type: 'ACADEMIC',
    requires_follow_up: false,
    created_at: '2026-07-10T10:00:00Z',
  };
}

function createPort() {
  const pending = new Map<string, Deferred<TrackingSession>>();
  const pendingFor = (id: string) => {
    let entry = pending.get(id);
    if (!entry) {
      entry = deferred<TrackingSession>();
      pending.set(id, entry);
    }
    return entry;
  };
  const port: FichaTrackingPort = {
    listFichaTrackings: vi.fn(),
    getFichaTracking: vi.fn(),
    listTrackingSessions: vi.fn(async () => ({
      data: [],
      pagination: { page: 1, page_size: 10, total_items: 0, total_pages: 1 },
    })),
    createTrackingSession: vi.fn(),
    getTrackingSession: vi.fn((_trackingId: string, sessionId: string) => pendingFor(sessionId).promise),
  };
  return { port, pendingFor };
}

async function setup() {
  const { port, pendingFor } = createPort();
  const hook = renderHook(() => useTrackingSessions(port, 'tracking-1'));
  await waitFor(() => expect(hook.result.current.pagination).not.toBeNull());
  return { ...hook, pendingFor };
}

describe('useTrackingSessions - detalle de sesion', () => {
  afterEach(() => cleanup());

  it('abre el detalle en estado de carga y limpia el detalle anterior al cambiar de sesion', async () => {
    const { result, pendingFor } = await setup();

    act(() => { void result.current.loadDetail('session-a'); });
    await act(async () => { pendingFor('session-a').resolve(makeSession('session-a')); });
    expect(result.current.selectedSession?.id).toBe('session-a');

    act(() => { void result.current.loadDetail('session-b'); });
    expect(result.current.selectedSession).toBeNull();
    expect(result.current.isDetailOpen).toBe(true);
    expect(result.current.isLoadingDetail).toBe(true);

    await act(async () => { pendingFor('session-b').resolve(makeSession('session-b')); });
    expect(result.current.selectedSession?.id).toBe('session-b');
    expect(result.current.isLoadingDetail).toBe(false);
  });

  it('una respuesta antigua que llega tarde no sobrescribe la seleccion mas reciente', async () => {
    const { result, pendingFor } = await setup();

    act(() => { void result.current.loadDetail('session-a'); });
    act(() => { void result.current.loadDetail('session-b'); });
    await act(async () => {
      pendingFor('session-b').resolve(makeSession('session-b'));
      pendingFor('session-a').resolve(makeSession('session-a'));
    });

    expect(result.current.selectedSession?.id).toBe('session-b');
  });

  it('si se cierra el detalle, una respuesta en vuelo no lo vuelve a abrir', async () => {
    const { result, pendingFor } = await setup();

    act(() => { void result.current.loadDetail('session-a'); });
    act(() => { result.current.clearSelected(); });
    await act(async () => { pendingFor('session-a').resolve(makeSession('session-a')); });

    expect(result.current.selectedSession).toBeNull();
    expect(result.current.isDetailOpen).toBe(false);
  });

  it('expone el error del detalle sin cerrar el modal', async () => {
    const { result, pendingFor } = await setup();

    act(() => { void result.current.loadDetail('session-a'); });
    await act(async () => { pendingFor('session-a').reject(new Error('boom')); });

    expect(result.current.detailError).toBe('boom');
    expect(result.current.isDetailOpen).toBe(true);
    expect(result.current.isLoadingDetail).toBe(false);
    expect(result.current.selectedSession).toBeNull();
  });
});