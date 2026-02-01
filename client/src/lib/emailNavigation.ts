/**
 * Utility function to get the next email after deletion
 * Used across all view components for consistent navigation behavior
 */
export function getNextEmailAfterDelete<T extends { id: string }>(
  emails: T[],
  deletedEmailId: string | undefined
): T | null {
  if (!deletedEmailId || emails.length === 0) return null;

  const deletedIndex = emails.findIndex((e) => e.id === deletedEmailId);
  if (deletedIndex === -1) return null;

  // If this was the only email, return null
  if (emails.length <= 1) return null;

  // Prefer next email, fallback to previous
  if (deletedIndex < emails.length - 1) {
    return emails[deletedIndex + 1];
  }
  return emails[deletedIndex - 1] ?? null;
}
