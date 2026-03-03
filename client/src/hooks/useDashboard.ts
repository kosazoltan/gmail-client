import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.get(),
    refetchInterval: 120000, // 2 percenként frissít
    staleTime: 60000,
  });
}
