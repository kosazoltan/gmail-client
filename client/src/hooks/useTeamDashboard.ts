import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useTeamDashboard() {
  return useQuery({
    queryKey: ['team', 'dashboard'],
    queryFn: () => api.team.dashboard(),
    refetchInterval: 10000, // 10 mp auto-refresh
    staleTime: 5000,
    retry: 1,
  });
}
