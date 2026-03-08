import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useTeamDashboard() {
  return useQuery({
    queryKey: ['team', 'dashboard'],
    queryFn: () => api.team.dashboard(),
    refetchInterval: 60000, // 1 perc — email adatok nem változnak gyakran
    staleTime: 300000, // 5 perc cache
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
