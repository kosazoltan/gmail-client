const syncIntervals = new Map<string, NodeJS.Timeout>();

export function hasBackgroundSync(accountId: string): boolean {
  return syncIntervals.has(accountId);
}

export function registerBackgroundSync(accountId: string, interval: NodeJS.Timeout): void {
  syncIntervals.set(accountId, interval);
}

export function stopBackgroundSync(accountId: string): void {
  const interval = syncIntervals.get(accountId);
  if (interval) {
    clearInterval(interval);
    syncIntervals.delete(accountId);
  }
}

export function stopAllBackgroundSyncs(): void {
  for (const interval of syncIntervals.values()) {
    clearInterval(interval);
  }
  syncIntervals.clear();
}
