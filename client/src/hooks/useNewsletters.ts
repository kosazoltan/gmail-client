import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// Hírlevél küldők listázása
export function useNewsletterSenders() {
  return useQuery({
    queryKey: ['newsletters', 'senders'],
    queryFn: () => api.newsletters.getSenders(),
  });
}

// Hírlevél statisztikák
export function useNewsletterStats() {
  return useQuery({
    queryKey: ['newsletters', 'stats'],
    queryFn: () => api.newsletters.getStats(),
  });
}

// Hírlevél emailek
export function useNewsletterEmails(params: {
  page?: number;
  limit?: number;
  senderId?: string;
  includeMuted?: boolean;
} = {}) {
  return useQuery({
    queryKey: ['newsletters', 'emails', params],
    queryFn: () => api.newsletters.getEmails(params),
  });
}

// Hírlevél szinkronizálás
export function useSyncNewsletters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.newsletters.sync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters'] });
    },
  });
}

// Küldő némítása
export function useMuteNewsletterSender() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, muted }: { id: string; muted: boolean }) =>
      api.newsletters.muteSender(id, muted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters'] });
    },
  });
}

// Küldő eltávolítása
export function useRemoveNewsletterSender() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.newsletters.removeSender(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newsletters'] });
    },
  });
}
