import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ScheduledEmail } from '../types';

export function useScheduledEmails() {
  return useQuery({
    queryKey: ['scheduledEmails'],
    queryFn: async () => {
      const result = await api.scheduled.list();
      return result.scheduledEmails as ScheduledEmail[];
    },
    staleTime: 30000,
  });
}

export function useCreateScheduledEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      to: string;
      cc?: string;
      subject?: string;
      body?: string;
      scheduledAt: number;
    }) => api.scheduled.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledEmails'] });
    },
  });
}

export function useUpdateScheduledEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: {
        to?: string;
        cc?: string;
        subject?: string;
        body?: string;
        scheduledAt?: number;
      };
    }) => api.scheduled.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledEmails'] });
    },
  });
}

export function useDeleteScheduledEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.scheduled.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledEmails'] });
    },
  });
}

export function useSendScheduledNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.scheduled.sendNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledEmails'] });
    },
  });
}

// Helper functions for scheduling options
export function getScheduleOptions() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return [
    {
      id: 'later_today',
      label: 'Ma délután 14:00',
      time: new Date(today.getTime() + 14 * 60 * 60 * 1000).getTime(),
      show: now.getHours() < 14,
    },
    {
      id: 'this_evening',
      label: 'Ma este 18:00',
      time: new Date(today.getTime() + 18 * 60 * 60 * 1000).getTime(),
      show: now.getHours() < 18,
    },
    {
      id: 'tomorrow_morning',
      label: 'Holnap reggel 9:00',
      time: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000).getTime(),
      show: true,
    },
    {
      id: 'tomorrow_afternoon',
      label: 'Holnap délután 14:00',
      time: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000).getTime(),
      show: true,
    },
    {
      id: 'next_week',
      label: 'Jövő hétfő reggel 9:00',
      time: getNextMonday9AM(now),
      show: true,
    },
  ].filter((opt) => opt.show);
}

function getNextMonday9AM(now: Date): number {
  const result = new Date(now);
  result.setHours(9, 0, 0, 0);

  // Find next Monday
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  result.setDate(result.getDate() + daysUntilMonday);

  return result.getTime();
}

// Format scheduled time for display
export function formatScheduledTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const dateOfTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeStr = date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

  if (dateOfTimestamp.getTime() === today.getTime()) {
    return `Ma ${timeStr}`;
  }
  if (dateOfTimestamp.getTime() === tomorrow.getTime()) {
    return `Holnap ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('hu-HU', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
  return `${dateStr} ${timeStr}`;
}
