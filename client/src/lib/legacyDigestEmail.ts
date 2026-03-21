/**
 * Régi AI digest e-mailek: plain + HTML egy text/html testben, <!-- HTML version below --> elválasztóval.
 * A HTML whitespace-szabályai miatt a plain rész egybefüggő "falként" jelent meg.
 */
export const LEGACY_AI_DIGEST_MARKER = '<!-- HTML version below -->';

export function trySplitLegacyAiDigestBodyHtml(
  bodyHtml: string | null | undefined,
): { plain: string; restHtml: string } | null {
  if (!bodyHtml) return null;
  const idx = bodyHtml.indexOf(LEGACY_AI_DIGEST_MARKER);
  if (idx === -1) return null;
  const plain = bodyHtml.slice(0, idx).trim();
  const restHtml = bodyHtml.slice(idx + LEGACY_AI_DIGEST_MARKER.length).trim();
  if (!plain && !restHtml) return null;
  return { plain, restHtml };
}
