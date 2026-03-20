import { useQuery } from '@tanstack/react-query';
import { Gauge } from 'lucide-react';
import { api } from '../../lib/api';

export function QuotaIndicator() {
  const { data } = useQuery({
    queryKey: ['quota-indicator'],
    queryFn: () => api.quota.get(),
    refetchInterval: 60000,
  });

  const percent = data?.quota?.percent ?? 0;
  const colorClass =
    percent > 95
      ? 'text-red-500'
      : percent > 80
        ? 'text-amber-500'
        : 'text-gray-500 dark:text-dark-text-secondary';

  return (
    <div
      title={`Napi API kvóta: ${percent}%`}
      className={`flex items-center gap-1 rounded-lg px-2 py-1 ${colorClass}`}
    >
      <Gauge className="h-4 w-4" />
      <span className="text-xs font-medium">{percent}%</span>
    </div>
  );
}
