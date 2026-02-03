import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
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

// Hírlevél emailek infinite scroll
export function useNewsletterEmailsInfinite(params: {
  limit?: number;
  senderId?: string;
  includeMuted?: boolean;
} = {}) {
  return useInfiniteQuery({
    queryKey: ['newsletters', 'emails-infinite', params.senderId, params.includeMuted],
    queryFn: ({ pageParam = 1 }) => api.newsletters.getEmails({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
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
