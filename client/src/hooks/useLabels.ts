import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useLabels() {
  return useQuery({
    queryKey: ['labels'],
    queryFn: () => api.labels.list(),
    staleTime: 5 * 60 * 1000, // 5 perc cache
  });
}

export function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; backgroundColor?: string; textColor?: string }) =>
      api.labels.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}

export function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (labelId: string) => api.labels.delete(labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}

export function useAddLabelToEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ emailId, labelIds }: { emailId: string; labelIds: string[] }) =>
      api.labels.addToEmail(emailId, labelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}

export function useRemoveLabelFromEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ emailId, labelIds }: { emailId: string; labelIds: string[] }) =>
      api.labels.removeFromEmail(emailId, labelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}

export function useMoveEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      emailId,
      addLabelIds,
      removeLabelIds,
    }: {
      emailId: string;
      addLabelIds: string[];
      removeLabelIds: string[];
    }) => api.labels.moveEmail(emailId, addLabelIds, removeLabelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}
