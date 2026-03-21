import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useDashboard(enabled = true) {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.get(),
    refetchInterval: enabled ? 120000 : false, // 2 percenként frissít
    staleTime: 0, // törlés / kuka után ne maradjon 1 percig „friss” a cache
    enabled,
    retry: 2,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
