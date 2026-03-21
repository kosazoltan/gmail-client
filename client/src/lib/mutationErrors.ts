/**
 * API `request()` hibák: ha a szerver küldött üzenetet (pl. OAuth újra belépés), azt mutassuk;
 * egyébként általános fallback (HTTP 500 / üres body).
 */
export function userVisibleApiError(error: unknown, fallback: string): string {
  const msg = error instanceof Error ? error.message.trim() : '';
  if (!msg || /^HTTP \d+$/.test(msg) || msg === 'Hálózati hiba') return fallback;
  return msg;
}
