import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useDetectedTasks(params?: { status?: string; priority?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['detected-tasks', params],
    queryFn: () => api.detectedTasks.list(params),
    staleTime: 30000,
  });
}

export function useDetectedTaskStats() {
  return useQuery({
    queryKey: ['detected-tasks', 'stats'],
    queryFn: () => api.detectedTasks.stats(),
    staleTime: 30000,
  });
}

export function useScanTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (daysBack: number) => api.detectedTasks.scan(daysBack),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detected-tasks'] });
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
    },
  });
}

export function useDeleteDetectedTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.detectedTasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detected-tasks'] });
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
    },
  });
}
