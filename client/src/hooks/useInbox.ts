import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useInbox(params: { accountId?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['inbox', params],
    queryFn: () => api.views.inbox(params),
    enabled: !!params.accountId,
  });
}

export function useInboxInfinite(params: { accountId?: string } = {}) {
  return useInfiniteQuery({
    queryKey: ['inbox-infinite', params.accountId],
    queryFn: ({ pageParam = 1 }) => api.views.inbox({ ...params, page: pageParam }),
    enabled: !!params.accountId,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });
}
