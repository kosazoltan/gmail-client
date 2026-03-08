import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { SmartFolderRule } from '../types';

export function useSmartFolders() {
  return useQuery({
    queryKey: ['smartFolders'],
    queryFn: () => api.smartFolders.list(),
    staleTime: 60000,
  });
}

export function useSmartFolderEmails(folderId: string | null, page = 1) {
  return useQuery({
    queryKey: ['smartFolderEmails', folderId, page],
    queryFn: () => api.smartFolders.getEmails(folderId!, page),
    enabled: !!folderId,
    staleTime: 30000,
  });
}

export function useCreateSmartFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; rules: SmartFolderRule[]; icon?: string }) =>
      api.smartFolders.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smartFolders'] });
    },
  });
}

export function useUpdateSmartFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; icon?: string; rules?: SmartFolderRule[]; sortOrder?: number };
    }) => api.smartFolders.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smartFolders'] });
    },
  });
}

export function useGenerateSmartFolder() {
  return useMutation({
    mutationFn: (description: string) => api.smartFolders.generate(description),
  });
}

export function useDeleteSmartFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.smartFolders.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smartFolders'] });
    },
  });
}
