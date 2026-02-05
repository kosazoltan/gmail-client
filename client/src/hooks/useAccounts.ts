import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => api.auth.getSession(),
    refetchInterval: 60000, // 60 másodperc
    staleTime: 30000, // 30 másodpercig friss marad
    retry: 2, // 2x próbálkozás hiba esetén
    refetchOnWindowFocus: true, // Ablak fókuszra frissít
    refetchOnReconnect: true, // Újracsatlakozáskor frissít
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.getAll(),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async () => {
      const { url } = await api.auth.getLoginUrl();
      window.location.href = url;
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api.auth.logout(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useSwitchAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api.auth.switchAccount(accountId),
    onSuccess: () => {
      // FIX: Invalidate specific queries instead of all
      // This prevents unnecessary refetches (e.g., settings, UI state)
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['emails-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['email'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['unified-inbox-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['trash'] });
      queryClient.invalidateQueries({ queryKey: ['trash-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      queryClient.invalidateQueries({ queryKey: ['views'] });
      queryClient.invalidateQueries({ queryKey: ['snoozed'] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled'] });
      queryClient.invalidateQueries({ queryKey: ['vip'] });
    },
  });
}

export function useSyncAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, full = false }: { accountId: string; full?: boolean }) =>
      api.accounts.sync(accountId, full),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api.accounts.delete(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateAccountColor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, color }: { accountId: string; color: string }) =>
      api.accounts.updateColor(accountId, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
