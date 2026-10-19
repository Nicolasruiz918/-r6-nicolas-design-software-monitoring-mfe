import { describe, expect, it } from 'vitest';

import { MON_TRACKING_SESSION_CREATE, hasCapability } from '../../src/contracts/remote-props.js';

describe('hasCapability', () => {
  it('accepts the plain code', () => {
    expect(hasCapability([MON_TRACKING_SESSION_CREATE], MON_TRACKING_SESSION_CREATE)).toBe(true);
  });

  it('accepts the scoped code', () => {
    expect(hasCapability([`${MON_TRACKING_SESSION_CREATE}:OWN_FICHAS`], MON_TRACKING_SESSION_CREATE)).toBe(true);
  });

  it('rejects other or similar codes and missing lists', () => {
    expect(hasCapability(['MON_TRACKING_SESSION_VIEW'], MON_TRACKING_SESSION_CREATE)).toBe(false);
    expect(hasCapability([`${MON_TRACKING_SESSION_CREATE}_X`], MON_TRACKING_SESSION_CREATE)).toBe(false);
    expect(hasCapability(undefined, MON_TRACKING_SESSION_CREATE)).toBe(false);
  });
});