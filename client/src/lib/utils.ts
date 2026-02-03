import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { hu } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Dátum formázás email listához
export function formatEmailDate(timestamp: number): string {
  const date = new Date(timestamp);

  if (isToday(date)) {
    return format(date, 'HH:mm');
  }
  if (isYesterday(date)) {
    return 'Tegnap';
  }
  if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
    return format(date, 'EEEE', { locale: hu });
  }
  return format(date, 'yyyy. MMM d.', { locale: hu });
}

// Teljes dátum formázás
export function formatFullDate(timestamp: number): string {
  return format(new Date(timestamp), 'yyyy. MMMM d. HH:mm', { locale: hu });
}

// Relatív idő
export function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: hu });
}

// Fájlméret formázás
export function formatFileSize(bytes: number): string {
  // FIX: Handle edge cases - 0, negative, NaN, Infinity
  if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Email cím rövidítése
export function shortenEmail(email: string): string {
  if (email.length <= 30) return email;
  const [local, domain] = email.split('@');
  if (local.length > 15) {
    return `${local.slice(0, 12)}...@${domain}`;
  }
  return email;
}

// Küldő megjelenítendő neve
export function displaySender(fromName: string | null, from: string | null): string {
  if (fromName && fromName.trim()) return fromName;
  if (from) return from;
  return 'Ismeretlen küldő';
}

// Monogram generálás avatar-hoz
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '??';

  const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) return '??';

  if (parts.length >= 2 && parts[0][0] && parts[parts.length - 1][0]) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase() || '??';
}

// Szín generálás email alapján (konzisztens)
export function emailToColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}
