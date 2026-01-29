import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useSavedSearches() {
  return useQuery({
    queryKey: ['savedSearches'],
    queryFn: () => api.savedSearches.list(),
  });
}

export function useCreateSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; query: string; icon?: string; color?: string }) =>
      api.savedSearches.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedSearches'] });
    },
  });
}

export function useUpdateSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; query?: string; icon?: string; color?: string };
    }) => api.savedSearches.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedSearches'] });
    },
  });
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.savedSearches.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedSearches'] });
    },
  });
}

export function useIncrementSearchUsage() {
  return useMutation({
    mutationFn: (id: string) => api.savedSearches.use(id),
  });
}
