import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useTrash(params: { accountId?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['trash', params],
    queryFn: () => api.views.trash(params),
    enabled: !!params.accountId,
  });
}
