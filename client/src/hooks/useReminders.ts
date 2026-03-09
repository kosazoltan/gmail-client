import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getFailureCount } from '../lib/api';
import type { Reminder } from '../types';

// Emlékeztetők listázása
export function useReminders(includeCompleted = false) {
  return useQuery({
    queryKey: ['reminders', { includeCompleted }],
    queryFn: () => api.reminders.list(includeCompleted),
  });
}

// Esedékes emlékeztetők
export function useDueReminders() {
  return useQuery({
    queryKey: ['reminders', 'due'],
    queryFn: () => api.reminders.due(),
    refetchInterval: (query) => {
      if (query.state.status === 'error') {
        const failures = getFailureCount('/reminders/due');
        return Math.min(60000 * Math.pow(2, Math.min(failures, 3)), 300000);
      }
      return 60000; // 60 seconds
    },
  });
}

// Esedékes emlékeztetők száma
export function useDueRemindersCount(enabled = true) {
  return useQuery({
    queryKey: ['reminders', 'count'],
    queryFn: async () => {
      const response = await api.reminders.count();
      return response.count;
    },
    refetchInterval: (query) => {
      if (!enabled) return false;
      if (query.state.status === 'error') {
        const failures = getFailureCount('/reminders/count');
        return Math.min(60000 * Math.pow(2, Math.min(failures, 3)), 300000);
      }
      return 60000; // 60 seconds
    },
    enabled,
  });
}

// Emlékeztető létrehozása
export function useCreateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { emailId: string; remindAt: number; note?: string }) =>
      api.reminders.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

// Emlékeztető frissítése
export function useUpdateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { remindAt?: number; note?: string; isCompleted?: boolean };
    }) => api.reminders.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

// Emlékeztető törlése
export function useDeleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.reminders.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

// Emlékeztető teljesítettnek jelölése
export function useCompleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.reminders.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

// Re-export the type for convenience
export type { Reminder };
