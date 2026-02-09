import {
  Inbox,
  Search,
  Clock,
  Trash2,
  Paperclip,
  Newspaper,
  Bell,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';

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
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-6 text-center">
      <div className="dark:bg-dark-bg-tertiary mb-4 rounded-2xl bg-gray-100 p-4">
        <Icon className="dark:text-dark-text-muted h-10 w-10 text-gray-300" strokeWidth={1.5} />
      </div>
      <h3 className="dark:text-dark-text-secondary mb-1 text-base font-medium text-gray-600">
        {title}
      </h3>
      {description && (
        <p className="dark:text-dark-text-muted max-w-xs text-sm text-gray-400">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-[#4f6ef7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d5ce5]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
