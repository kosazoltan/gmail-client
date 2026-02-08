import { Inbox, Search, Clock, Trash2, Paperclip, Newspaper, Bell, CalendarClock, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-dark-bg-tertiary mb-4">
        <Icon className="h-10 w-10 text-gray-300 dark:text-dark-text-muted" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-medium text-gray-600 dark:text-dark-text-secondary mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-400 dark:text-dark-text-muted max-w-xs">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-sm font-medium bg-[#4f6ef7] hover:bg-[#3d5ce5] text-white rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
