import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

const MAX_QUERY_LENGTH = 500;

export function useSearch(
  query: string,
  params?: { page?: number; limit?: number; accountId?: string; allAccounts?: boolean },
) {
  const normalizedQuery = query.trim().slice(0, MAX_QUERY_LENGTH);

  return useQuery({
    queryKey: ['search', normalizedQuery, params],
    queryFn: () => api.search.query(normalizedQuery, params),
    enabled: normalizedQuery.length >= 2,
  });
}
