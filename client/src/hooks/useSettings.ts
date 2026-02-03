import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { UserSettings, SwipeAction } from '../types';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const result = await api.settings.getAll();
      return result.settings as UserSettings;
    },
    staleTime: 60000,
  });
}

export function useSetting<T>(key: keyof UserSettings) {
  return useQuery({
    queryKey: ['settings', key],
    queryFn: async () => {
      const result = await api.settings.get(key);
      return result.value as T;
    },
    staleTime: 60000,
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api.settings.set(key, value),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['settings', variables.key] });
    },
  });
}

// Alapértelmezett beállítások
export const defaultSettings: UserSettings = {
  swipeLeftAction: 'delete',
  swipeRightAction: 'read',
  undoSendDelay: 5,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  quietHoursWeekendOnly: false,
  toolbarActions: ['reply', 'forward', 'star', 'delete', 'snooze', 'remind'],
  theme: 'system',
};

// Helper a swipe action címkéhez
export function getSwipeActionLabel(action: SwipeAction): string {
  const labels: Record<SwipeAction, string> = {
    delete: 'Törlés',
    archive: 'Archiválás',
    read: 'Olvasott/Olvasatlan',
    star: 'Csillag',
    snooze: 'Szundi',
    none: 'Nincs művelet',
  };
  return labels[action];
}

// Helper a swipe action ikonjához
export function getSwipeActionIcon(action: SwipeAction): string {
  const icons: Record<SwipeAction, string> = {
    delete: 'trash-2',
    archive: 'archive',
    read: 'mail',
    star: 'star',
    snooze: 'clock',
    none: 'x',
  };
  return icons[action];
}

// Helper a swipe action színéhez
export function getSwipeActionColor(action: SwipeAction): string {
  const colors: Record<SwipeAction, string> = {
    delete: '#EF4444',
    archive: '#8B5CF6',
    read: '#3B82F6',
    star: '#F59E0B',
    snooze: '#10B981',
    none: '#6B7280',
  };
  return colors[action];
}
