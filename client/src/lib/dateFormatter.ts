/**
 * Email dátum formázás intelligens megjelenítéssel
 */
export function formatEmailDate(date: Date | number): string {
  const emailDate = typeof date === 'number' ? new Date(date) : date;
  const now = new Date();

  // Milliszekundumok közötti különbség
  const diff = now.getTime() - emailDate.getTime();

  // Napok közötti különbség (0:00-tól számítva)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const emailDay = new Date(emailDate.getFullYear(), emailDate.getMonth(), emailDate.getDate());
  const diffDays = Math.floor((today.getTime() - emailDay.getTime()) / (1000 * 60 * 60 * 24));

  // Ma - csak óra:perc
  if (diffDays === 0) {
    return emailDate.toLocaleTimeString('hu-HU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Tegnap
  if (diffDays === 1) {
    return 'Tegnap';
  }

  // Ezen a héten - hét napja
  if (diffDays < 7) {
    return emailDate.toLocaleDateString('hu-HU', { weekday: 'long' });
  }

  // Idén - hónap + nap
  if (emailDate.getFullYear() === now.getFullYear()) {
    return emailDate.toLocaleDateString('hu-HU', {
      month: 'short',
      day: 'numeric'
    });
  }

  // Régebbi - év + hónap + nap
  return emailDate.toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Teljes dátum formázás tooltip-okhoz
 */
export function formatEmailDateTooltip(date: Date | number): string {
  const emailDate = typeof date === 'number' ? new Date(date) : date;

  return emailDate.toLocaleString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Relatív idő formázás ("2 perce", "5 órája", stb.)
 */
export function formatRelativeTime(date: Date | number): string {
  const emailDate = typeof date === 'number' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - emailDate.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'Most';
  if (minutes < 60) return `${minutes} perce`;
  if (hours < 24) return `${hours} órája`;
  if (days < 7) return `${days} napja`;
  if (weeks < 4) return `${weeks} hete`;
  if (months < 12) return `${months} hónapja`;
  return `${years} éve`;
}
