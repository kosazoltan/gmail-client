/**
 * Server-side bot / crawler / spider user-agent detector.
 *
 * Mirrors client/src/lib/isBotUserAgent.ts to give defense-in-depth at the
 * /error-report endpoint: even if a future client build forgets the front-end
 * suppression, automated crawlers still cannot flood the inbox.
 *
 * Keep the regex in sync with the client copy.
 */
const BOT_UA_PATTERN =
  /(bot|crawler|spider|slurp|bingpreview|mediapartners|facebookexternalhit|embedly|quora link preview|outbrain|pinterest|vkshare|w3c_validator|whatsapp|telegrambot|skypeuripreview|nuzzel|bitlybot|tumblr|discordbot|google-inspectiontool|chrome-lighthouse|headlesschrome|prerender|phantomjs|playwright)/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || typeof ua !== 'string') return false;
  // Defense-in-depth: treat absurdly long UA strings as bots to avoid pathological
  // regex work and to short-circuit potential abuse vectors.
  if (ua.length > 2048) return true;
  return BOT_UA_PATTERN.test(ua);
}
