import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useCalendarToday() {
  return useQuery({
    queryKey: ['calendar', 'today'],
    queryFn: () => api.calendar.today(),
    staleTime: 60000,
  });
}

export function useCalendarWeek() {
  return useQuery({
    queryKey: ['calendar', 'week'],
    queryFn: () => api.calendar.week(),
    staleTime: 60000,
  });
}

export function useCalendarEvents(params?: { timeMin?: string; timeMax?: string }) {
  return useQuery({
    queryKey: ['calendar', 'events', params],
    queryFn: () => api.calendar.events(params),
    staleTime: 60000,
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      summary: string;
      description?: string;
      location?: string;
      start: string;
      end?: string;
      isAllDay: boolean;
    }) => api.calendar.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: {
      id: string;
      summary: string;
      description?: string;
      location?: string;
      start: string;
      end?: string;
      isAllDay: boolean;
    }) => api.calendar.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.calendar.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}
