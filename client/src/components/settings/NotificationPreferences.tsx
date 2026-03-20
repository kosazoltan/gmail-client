import { Bell } from 'lucide-react';
import { useSettings, useUpdateSetting, defaultSettings } from '../../hooks/useSettings';
import { cn } from '../../lib/utils';

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative h-6 w-12 rounded-full',
        on ? 'bg-[#4f6ef7]' : 'bg-gray-300 dark:bg-gray-700',
      )}
    >
      <span
        className={cn(
          'absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform',
          on && 'translate-x-6',
        )}
      />
    </button>
  );
}

export function NotificationPreferences() {
  const { data: settings } = useSettings();
  const update = useUpdateSetting();

  const desktop =
    settings?.desktopNotificationsEnabled ?? defaultSettings.desktopNotificationsEnabled ?? false;
  const vipOnly = settings?.vipNotificationsOnly ?? defaultSettings.vipNotificationsOnly ?? false;
  const sound =
    settings?.notificationSoundEnabled ?? defaultSettings.notificationSoundEnabled ?? false;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Bell className="h-4 w-4" /> Desktop értesítések
      </div>
      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
        <span className="text-sm">Desktop értesítések engedélyezése</span>
        <Toggle
          on={desktop}
          onClick={() => update.mutate({ key: 'desktopNotificationsEnabled', value: !desktop })}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
        <span className="text-sm">Csak VIP küldőknél</span>
        <Toggle
          on={vipOnly}
          onClick={() => update.mutate({ key: 'vipNotificationsOnly', value: !vipOnly })}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
        <span className="text-sm">Értesítési hang</span>
        <Toggle
          on={sound}
          onClick={() => update.mutate({ key: 'notificationSoundEnabled', value: !sound })}
        />
      </div>
    </div>
  );
}
