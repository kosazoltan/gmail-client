import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useSearch(query: string, params?: { page?: number; accountId?: string }) {
  return useQuery({
    queryKey: ['search', query, params],
    queryFn: () => api.search.query(query, params),
    enabled: query.length >= 2,
  });
}
