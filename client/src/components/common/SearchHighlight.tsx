interface SearchHighlightProps {
  text: string;
  query: string;
  className?: string;
}

export function SearchHighlight({ text, query, className = '' }: SearchHighlightProps) {
  if (!query || !text) {
    return <>{text}</>;
  }

  let parts: string[] | null = null;

  try {
    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
  } catch {
    // Ha valami hiba van a regex-szel, visszaadjuk az eredeti szöveget
    parts = null;
  }

  if (!parts) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className={`dark:text-dark-text bg-yellow-200 font-medium text-gray-900 dark:bg-yellow-600/40 ${className}`}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
