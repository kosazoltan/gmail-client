import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useTeamDashboard() {
  return useQuery({
    queryKey: ['team', 'dashboard'],
    queryFn: () => api.team.dashboard(),
    refetchInterval: false, // Ne pollingoljon — a team API nem elérhető Render-en
    staleTime: 300000, // 5 perc cache
    retry: 0, // Ne retry-ozzon 503-ra
    refetchOnWindowFocus: false,
  });
}
