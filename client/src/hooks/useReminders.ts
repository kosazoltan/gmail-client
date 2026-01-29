import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
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
    refetchInterval: 60000, // Poll every minute
  });
}

// Esedékes emlékeztetők száma
export function useDueRemindersCount() {
  return useQuery({
    queryKey: ['reminders', 'count'],
    queryFn: async () => {
      const response = await api.reminders.count();
      return response.count;
    },
    refetchInterval: 60000, // Poll every minute
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
