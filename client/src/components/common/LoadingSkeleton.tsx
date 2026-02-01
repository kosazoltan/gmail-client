interface LoadingSkeletonProps {
  type?: 'list' | 'detail' | 'spinner';
  count?: number;
}

export function LoadingSkeleton({ type = 'spinner', count = 5 }: LoadingSkeletonProps) {
  if (type === 'spinner') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="h-12 w-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
        <p className="text-sm text-gray-500 dark:text-dark-text-secondary">Betöltés...</p>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="divide-y divide-gray-100 dark:divide-dark-border">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-4 flex gap-3 animate-pulse">
            {/* Avatar skeleton */}
            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-dark-bg-tertiary flex-shrink-0" />

            {/* Content skeleton */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 dark:bg-dark-bg-tertiary rounded w-1/3" />
                <div className="h-3 bg-gray-200 dark:bg-dark-bg-tertiary rounded w-16" />
              </div>
              <div className="h-3 bg-gray-200 dark:bg-dark-bg-tertiary rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-dark-bg-tertiary rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'detail') {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="space-y-3">
          <div className="h-6 bg-gray-200 dark:bg-dark-bg-tertiary rounded w-2/3" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-dark-bg-tertiary" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-200 dark:bg-dark-bg-tertiary rounded w-1/4" />
              <div className="h-3 bg-gray-200 dark:bg-dark-bg-tertiary rounded w-1/3" />
            </div>
          </div>
        </div>

        {/* Body skeleton */}
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-dark-bg-tertiary rounded w-full" />
          <div className="h-3 bg-gray-200 dark:bg-dark-bg-tertiary rounded w-5/6" />
          <div className="h-3 bg-gray-200 dark:bg-dark-bg-tertiary rounded w-4/6" />
          <div className="h-3 bg-gray-200 dark:bg-dark-bg-tertiary rounded w-full" />
          <div className="h-3 bg-gray-200 dark:bg-dark-bg-tertiary rounded w-3/4" />
        </div>
      </div>
    );
  }

  return null;
}
