import type { QueryClient } from '@tanstack/react-query';

/**
 * Levél kukázása / törlése után: ne maradjon „friss” a React Query cache-ben a Home.
 * resetQueries(dashboard) + invalidálás: AI brief, feladatok, intelligencia, naptár.
 */
export async function refreshAfterEmailMovedToTrash(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries({ queryKey: ['dashboard'], exact: true });
  await queryClient.resetQueries({ queryKey: ['dashboard'], exact: true });

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['emails'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['emails-infinite'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['email'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['thread'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['inbox'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['inbox-infinite'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['unified-inbox'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['unified-inbox-infinite'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['trash'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['trash-infinite'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['views'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['search'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['detected-tasks'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['detected-tasks', 'stats'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['daily-brief-latest'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['unread-count'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['actionItems'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['calendar'], refetchType: 'active' }),
  ]);
}

/** Feladat státusz / szundi után: Home + lista frissítése */
export async function refreshDashboardAndDetectedTasks(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries({ queryKey: ['dashboard'], exact: true });
  await queryClient.resetQueries({ queryKey: ['dashboard'], exact: true });
  await queryClient.invalidateQueries({ queryKey: ['detected-tasks'], refetchType: 'active' });
  await queryClient.invalidateQueries({
    queryKey: ['detected-tasks', 'stats'],
    refetchType: 'active',
  });
}
