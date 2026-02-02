import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function usePinnedEmails() {
  return useQuery({
    queryKey: ['pinnedEmails'],
    queryFn: () => api.pinned.list(),
    staleTime: 30000, // 30 másodperc
  });
}

export function useTogglePin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emailId: string) => api.pinned.toggle(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinnedEmails'] });
    },
  });
}

export function usePinEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emailId: string) => api.pinned.pin(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinnedEmails'] });
    },
  });
}

export function useUnpinEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emailId: string) => api.pinned.unpin(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinnedEmails'] });
    },
  });
}
