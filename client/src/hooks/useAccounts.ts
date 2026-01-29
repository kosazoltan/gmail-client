import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => api.auth.getSession(),
    refetchInterval: 30000,
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
      queryClient.invalidateQueries();
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
