import { useQuery } from '@tanstack/react-query';
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
