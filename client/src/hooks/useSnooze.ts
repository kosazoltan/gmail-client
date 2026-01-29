import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useSnoozedEmails() {
  return useQuery({
    queryKey: ['snoozedEmails'],
    queryFn: () => api.snooze.list(),
  });
}

export function useSnoozeEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ emailId, snoozeUntil }: { emailId: string; snoozeUntil: number }) =>
      api.snooze.create(emailId, snoozeUntil),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snoozedEmails'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}

export function useUnsnoozeEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emailId: string) => api.snooze.delete(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snoozedEmails'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}

// Segéd függvények a szundi időpontok számításához
export function getSnoozeOptions() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return [
    {
      id: 'later_today',
      label: 'Ma délután',
      time: new Date(today.getTime() + 14 * 60 * 60 * 1000).getTime(), // 14:00
      show: now.getHours() < 14,
    },
    {
      id: 'this_evening',
      label: 'Ma este',
      time: new Date(today.getTime() + 18 * 60 * 60 * 1000).getTime(), // 18:00
      show: now.getHours() < 18,
    },
    {
      id: 'tomorrow_morning',
      label: 'Holnap reggel',
      time: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000).getTime(), // Holnap 9:00
      show: true,
    },
    {
      id: 'next_week',
      label: 'Jövő hétfő',
      time: getNextMonday9AM(now),
      show: true,
    },
  ].filter((opt) => opt.show);
}

function getNextMonday9AM(now: Date): number {
  const result = new Date(now);
  result.setHours(9, 0, 0, 0);

  // Megkeressük a következő hétfőt
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  result.setDate(result.getDate() + daysUntilMonday);

  return result.getTime();
}
