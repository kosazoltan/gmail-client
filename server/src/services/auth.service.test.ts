import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { queryOneMock, executeMock, deleteTokensMock } = vi.hoisted(() => ({
  queryOneMock: vi.fn(),
  executeMock: vi.fn(),
  deleteTokensMock: vi.fn(),
}));

vi.mock('../db/index.js', () => ({
  queryOne: queryOneMock,
  queryAll: vi.fn(),
  execute: executeMock,
}));

vi.mock('./token-vault.service.js', () => ({
  saveTokens: vi.fn(),
  getTokens: vi.fn(),
  deleteTokens: deleteTokensMock,
  getVaultMarker: vi.fn(() => '__vault__'),
  isVaultMarker: vi.fn(() => true),
}));

import { deleteAccount } from './auth.service.js';
import {
  hasBackgroundSync,
  registerBackgroundSync,
  stopAllBackgroundSyncs,
} from './background-sync-registry.js';

describe('deleteAccount background sync lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    queryOneMock.mockReset();
    executeMock.mockReset();
    deleteTokensMock.mockReset();
    stopAllBackgroundSyncs();
  });

  afterEach(() => {
    stopAllBackgroundSyncs();
    vi.useRealTimers();
  });

  it('stops the account interval before token and account deletion', async () => {
    const tick = vi.fn();
    registerBackgroundSync('account-1', setInterval(tick, 100));
    queryOneMock.mockImplementation(async () => {
      expect(hasBackgroundSync('account-1')).toBe(false);
      return { email: 'account@example.com' };
    });
    deleteTokensMock.mockImplementation(async () => {
      expect(hasBackgroundSync('account-1')).toBe(false);
    });
    executeMock.mockImplementation(async () => {
      expect(hasBackgroundSync('account-1')).toBe(false);
    });

    await deleteAccount('account-1');
    vi.advanceTimersByTime(500);

    expect(tick).not.toHaveBeenCalled();
    expect(deleteTokensMock).toHaveBeenCalledWith('account@example.com');
    expect(executeMock).toHaveBeenCalledWith('DELETE FROM accounts WHERE id = ?', ['account-1']);
  });

  it('does not leak the interval when account lookup fails after the stop', async () => {
    const tick = vi.fn();
    registerBackgroundSync('account-1', setInterval(tick, 100));
    queryOneMock.mockRejectedValue(new Error('database unavailable'));

    await expect(deleteAccount('account-1')).rejects.toThrow('database unavailable');
    vi.advanceTimersByTime(500);

    expect(tick).not.toHaveBeenCalled();
    expect(hasBackgroundSync('account-1')).toBe(false);
  });

  it('does not leak the interval when token deletion fails after the stop', async () => {
    const tick = vi.fn();
    registerBackgroundSync('account-1', setInterval(tick, 100));
    queryOneMock.mockResolvedValue({ email: 'account@example.com' });
    deleteTokensMock.mockRejectedValue(new Error('vault unavailable'));

    await expect(deleteAccount('account-1')).rejects.toThrow('vault unavailable');
    vi.advanceTimersByTime(500);

    expect(tick).not.toHaveBeenCalled();
    expect(hasBackgroundSync('account-1')).toBe(false);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('does not leak the interval when account deletion fails after the stop', async () => {
    const tick = vi.fn();
    registerBackgroundSync('account-1', setInterval(tick, 100));
    queryOneMock.mockResolvedValue({ email: 'account@example.com' });
    deleteTokensMock.mockResolvedValue(undefined);
    executeMock.mockRejectedValue(new Error('delete failed'));

    await expect(deleteAccount('account-1')).rejects.toThrow('delete failed');
    vi.advanceTimersByTime(500);

    expect(tick).not.toHaveBeenCalled();
    expect(hasBackgroundSync('account-1')).toBe(false);
  });
});
