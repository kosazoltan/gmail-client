interface LoadingSkeletonProps {
  type?: 'list' | 'detail' | 'spinner';
  count?: number;
}

export function LoadingSkeleton({ type = 'spinner', count = 5 }: LoadingSkeletonProps) {
  if (type === 'spinner') {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-blue-800 dark:border-t-blue-400" />
        <p className="dark:text-dark-text-secondary text-sm text-gray-500">Betöltés...</p>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="dark:divide-dark-border divide-y divide-gray-100">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex animate-pulse gap-3 p-4">
            {/* Avatar skeleton */}
            <div className="dark:bg-dark-bg-tertiary h-10 w-10 flex-shrink-0 rounded-full bg-gray-200" />

            {/* Content skeleton */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="dark:bg-dark-bg-tertiary h-4 w-1/3 rounded bg-gray-200" />
                <div className="dark:bg-dark-bg-tertiary h-3 w-16 rounded bg-gray-200" />
              </div>
              <div className="dark:bg-dark-bg-tertiary h-3 w-3/4 rounded bg-gray-200" />
              <div className="dark:bg-dark-bg-tertiary h-3 w-1/2 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'detail') {
    return (
      <div className="animate-pulse space-y-6 p-6">
        {/* Header skeleton */}
        <div className="space-y-3">
          <div className="dark:bg-dark-bg-tertiary h-6 w-2/3 rounded bg-gray-200" />
          <div className="flex items-center gap-3">
            <div className="dark:bg-dark-bg-tertiary h-10 w-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="dark:bg-dark-bg-tertiary h-4 w-1/4 rounded bg-gray-200" />
              <div className="dark:bg-dark-bg-tertiary h-3 w-1/3 rounded bg-gray-200" />
            </div>
          </div>
        </div>

        {/* Body skeleton */}
        <div className="space-y-2">
          <div className="dark:bg-dark-bg-tertiary h-3 w-full rounded bg-gray-200" />
          <div className="dark:bg-dark-bg-tertiary h-3 w-5/6 rounded bg-gray-200" />
          <div className="dark:bg-dark-bg-tertiary h-3 w-4/6 rounded bg-gray-200" />
          <div className="dark:bg-dark-bg-tertiary h-3 w-full rounded bg-gray-200" />
          <div className="dark:bg-dark-bg-tertiary h-3 w-3/4 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return null;
}
