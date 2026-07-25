import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasBackgroundSync,
  registerBackgroundSync,
  stopAllBackgroundSyncs,
  stopBackgroundSync,
} from './background-sync-registry.js';

describe('background-sync-registry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopAllBackgroundSyncs();
  });

  afterEach(() => {
    stopAllBackgroundSyncs();
    vi.useRealTimers();
  });

  it('stops a registered account interval idempotently without leaking future ticks', () => {
    const tick = vi.fn();
    const interval = setInterval(tick, 100);

    registerBackgroundSync('account-1', interval);
    expect(hasBackgroundSync('account-1')).toBe(true);

    stopBackgroundSync('account-1');
    stopBackgroundSync('account-1');
    vi.advanceTimersByTime(500);

    expect(tick).not.toHaveBeenCalled();
    expect(hasBackgroundSync('account-1')).toBe(false);
  });

  it('allows registration again after stop and clears every account interval', () => {
    const firstTick = vi.fn();
    const secondTick = vi.fn();

    registerBackgroundSync('account-1', setInterval(firstTick, 100));
    stopBackgroundSync('account-1');
    registerBackgroundSync('account-1', setInterval(firstTick, 100));
    registerBackgroundSync('account-2', setInterval(secondTick, 100));

    stopAllBackgroundSyncs();
    vi.advanceTimersByTime(500);

    expect(firstTick).not.toHaveBeenCalled();
    expect(secondTick).not.toHaveBeenCalled();
    expect(hasBackgroundSync('account-1')).toBe(false);
    expect(hasBackgroundSync('account-2')).toBe(false);
  });
});
