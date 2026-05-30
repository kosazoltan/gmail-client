/**
 * Bot / crawler / spider user-agent detector.
 *
 * Used to suppress noisy error reports triggered by automated crawlers
 * (e.g. bingbot, googlebot) that fetch stale dynamic chunks after a deploy.
 * These reports do not represent real user impact.
 *
 * The regex avoids alternation backtracking by anchoring to literal substrings.
 * It is intentionally case-insensitive but does NOT use catastrophic constructs.
 */
const BOT_UA_PATTERN =
  /(bot|crawler|spider|slurp|bingpreview|mediapartners|facebookexternalhit|embedly|quora link preview|outbrain|pinterest|vkshare|w3c_validator|whatsapp|telegrambot|skypeuripreview|nuzzel|bitlybot|tumblr|discordbot|google-inspectiontool|chrome-lighthouse|headlesschrome|prerender|phantomjs|playwright)/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || typeof ua !== 'string') return false;
  if (ua.length > 2048) {
    // Defense-in-depth: ignore absurdly long UA strings to avoid pathological regex work.
    return true;
  }
  return BOT_UA_PATTERN.test(ua);
}
