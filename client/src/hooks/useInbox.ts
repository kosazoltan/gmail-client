import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useInbox(params: { accountId?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['inbox', params],
    queryFn: () => api.views.inbox(params),
    enabled: !!params.accountId,
  });
}
