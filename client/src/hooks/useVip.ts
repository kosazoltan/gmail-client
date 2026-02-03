import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { VipSender } from '../types';

// Get all VIP senders with details
export function useVipSenders() {
  return useQuery({
    queryKey: ['vipSenders'],
    queryFn: async () => {
      const result = await api.vip.list();
      return result.vipSenders as VipSender[];
    },
    staleTime: 60000,
  });
}

// Get just the VIP email addresses (for quick lookup)
export function useVipEmails() {
  return useQuery({
    queryKey: ['vipEmails'],
    queryFn: async () => {
      const result = await api.vip.emails();
      return new Set(result.emails);
    },
    staleTime: 60000,
  });
}

// Add a new VIP sender
export function useAddVip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, name }: { email: string; name?: string }) =>
      api.vip.add(email, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vipSenders'] });
      queryClient.invalidateQueries({ queryKey: ['vipEmails'] });
    },
  });
}

// Update VIP sender name
export function useUpdateVip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.vip.update(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vipSenders'] });
    },
  });
}

// Delete VIP sender
export function useDeleteVip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.vip.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vipSenders'] });
      queryClient.invalidateQueries({ queryKey: ['vipEmails'] });
    },
  });
}

// Toggle VIP status for an email
export function useToggleVip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, name }: { email: string; name?: string }) =>
      api.vip.toggle(email, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vipSenders'] });
      queryClient.invalidateQueries({ queryKey: ['vipEmails'] });
    },
  });
}

// Helper to check if an email is VIP
export function isVipEmail(email: string | null | undefined, vipEmails: Set<string> | undefined): boolean {
  if (!email || !vipEmails) return false;
  return vipEmails.has(email.toLowerCase());
}
