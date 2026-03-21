/**
 * Google Naptár rendszerlevelek HTML-je gyakran óránkénti rácsot épít nagy fix magasságokkal —
 * a kliensben üres, extrém magas fehér terület + kék „idővonal” sáv jelenik meg.
 */
export function isGoogleCalendarNotificationFrom(from: string | null | undefined): boolean {
  if (!from) return false;
  const f = from.toLowerCase();
  return (
    f.includes('calendar-notification@google.com') ||
    f.includes('calendar-noreply@google.com') ||
    f.includes('group.calendar.google.com')
  );
}
