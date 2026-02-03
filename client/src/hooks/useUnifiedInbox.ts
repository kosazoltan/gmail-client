import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useUnifiedInbox(params?: { page?: number; filterAccountId?: string }) {
  return useQuery({
    queryKey: ['unified-inbox', params?.page || 1, params?.filterAccountId || 'all'],
    queryFn: () => api.views.unified(params),
    staleTime: 30000,
  });
}

export function useUnifiedInboxInfinite(params?: { filterAccountId?: string }) {
  return useInfiniteQuery({
    queryKey: ['unified-inbox-infinite', params?.filterAccountId || 'all'],
    queryFn: ({ pageParam = 1 }) => api.views.unified({ ...params, page: pageParam }),
    staleTime: 30000,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });
}
