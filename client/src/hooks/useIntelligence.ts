import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useActionItems(emailId: string | null) {
  return useQuery({
    queryKey: ['actionItems', emailId],
    queryFn: () => api.intelligence.getActionItems(emailId!),
    enabled: !!emailId,
    staleTime: 60000,
  });
}

export function useExtractActionItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emailId: string) => api.intelligence.extractActionItems(emailId),
    onSuccess: (_data, emailId) => {
      queryClient.invalidateQueries({ queryKey: ['actionItems', emailId] });
    },
  });
}

export function useToggleActionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) =>
      api.intelligence.toggleActionItem(id, isDone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actionItems'] });
    },
  });
}

export function useSentiment(emailId: string | null) {
  return useMutation({
    mutationFn: () => api.intelligence.detectSentiment(emailId!),
  });
}

export function useSuggestReply(emailId: string | null) {
  return useMutation({
    mutationFn: () => api.intelligence.suggestReply(emailId!),
  });
}

export function useRelatedEmails(emailId: string | null) {
  return useQuery({
    queryKey: ['relatedEmails', emailId],
    queryFn: () => api.intelligence.findRelated(emailId!),
    enabled: !!emailId,
    staleTime: 120000,
  });
}

export function useWeeklyReport() {
  return useQuery({
    queryKey: ['weeklyReport'],
    queryFn: () => api.intelligence.weeklyReport(),
    staleTime: 300000,
  });
}
