import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE } from '../lib/api';

export function useDetectedTasks(params?: { status?: string; priority?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['detected-tasks', params],
    queryFn: () => api.detectedTasks.list(params),
    staleTime: 30000,
  });
}

export function useDetectedTaskStats(enabled = true) {
  return useQuery({
    queryKey: ['detected-tasks', 'stats'],
    queryFn: () => api.detectedTasks.stats(),
    staleTime: 30000,
    enabled,
  });
}

export function useScanTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (daysBack: number) => api.detectedTasks.scan(daysBack),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detected-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateDetectedTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string } }) =>
      api.detectedTasks.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detected-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['detected-tasks', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteDetectedTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.detectedTasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detected-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['detected-tasks', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSnoozeDetectedTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      api.detectedTasks.snooze(id, days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detected-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['detected-tasks', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// --- SSE Scan Stream Hook ---

export interface ScanState {
  isScanning: boolean;
  phase: 'idle' | 'loading' | 'scanning' | 'updating' | 'done' | 'error';
  processed: number;
  total: number;
  found: number;
  skipped: number;
}

const INITIAL_SCAN_STATE: ScanState = {
  isScanning: false,
  phase: 'idle',
  processed: 0,
  total: 0,
  found: 0,
  skipped: 0,
};

export function useScanStream() {
  const [scanState, setScanState] = useState<ScanState>(INITIAL_SCAN_STATE);
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup: abort any in-flight scan on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const startScan = useCallback((daysBack: number) => {
    // Ha már fut, ne indítsunk újat
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setScanState({ isScanning: true, phase: 'loading', processed: 0, total: 0, found: 0, skipped: 0 });

    fetch(`${API_BASE}/detected-tasks/scan-stream?daysBack=${daysBack}`, {
      credentials: 'include',
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        // SSE nem elérhető — fallback a POST /scan-ra
        console.warn('[ScanStream] SSE failed, falling back to POST /scan');
        try {
          const fallbackResult = await api.detectedTasks.scan(daysBack);
          setScanState({
            isScanning: false,
            phase: 'done',
            processed: fallbackResult.newTasksCount,
            total: fallbackResult.newTasksCount,
            found: fallbackResult.newTasksCount,
            skipped: 0,
          });
          queryClient.invalidateQueries({ queryKey: ['detected-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['detected-tasks', 'stats'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        } catch {
          setScanState(prev => ({ ...prev, isScanning: false, phase: 'error' }));
        }
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setScanState(prev => ({
                ...prev,
                phase: data.phase,
                processed: data.processed ?? data.totalProcessed ?? prev.processed,
                total: data.total ?? data.totalProcessed ?? prev.total,
                found: data.found ?? data.newTasksCount ?? prev.found,
                skipped: data.skipped ?? data.existingSkipped ?? prev.skipped,
              }));

              if (data.phase === 'done' || data.phase === 'error') {
                setScanState(prev => ({ ...prev, isScanning: false }));
                queryClient.invalidateQueries({ queryKey: ['detected-tasks'] });
                queryClient.invalidateQueries({ queryKey: ['detected-tasks', 'stats'] });
                queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                abortRef.current = null;
              }
            } catch {
              /* skip parse errors */
            }
          }
        }
      }

      // Stream véget ért — ha még scanning-ben maradt, lezárjuk
      setScanState(prev => {
        if (prev.isScanning) {
          queryClient.invalidateQueries({ queryKey: ['detected-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['detected-tasks', 'stats'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          return { ...prev, isScanning: false, phase: 'done' };
        }
        return prev;
      });
      abortRef.current = null;
    }).catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') return;
      setScanState(prev => ({ ...prev, isScanning: false, phase: 'error' }));
      abortRef.current = null;
    });
  }, [queryClient]);

  return { scanState, startScan };
}
