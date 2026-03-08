import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useLatestBrief() {
  return useQuery({
    queryKey: ['daily-brief-latest'],
    queryFn: () => api.brief.latest(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 min
  });
}

export function useGenerateBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.brief.generate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-brief-latest'] });
    },
  });
}
