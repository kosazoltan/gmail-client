import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, Sparkles, Loader2, X, Workflow, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useSavedSearches } from '../../hooks/useSavedSearches';
import type { SearchSuggestion, SmartSearchResult } from '../../types';

/** Response shape when suggestionsOnly=true */
interface SmartSearchSuggestionsResponse {
  suggestions: string[];
}

interface SmartSearchBarProps {
  onSearch?: (query: string) => void;
  onSaveAsWorkflowStep?: (query: string) => void;
  className?: string;
}

export function SmartSearchBar({ onSearch, onSaveAsWorkflowStep, className }: SmartSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [result, setResult] = useState<SmartSearchResult | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Saved searches from API (recent searches)
  const { data: savedSearchesData } = useSavedSearches();
  const recentSavedSearches = useMemo<SearchSuggestion[]>(
    () => (savedSearchesData?.searches || [])
      .slice(0, 5)
      .map((s) => ({
        id: `saved-${s.id}`,
        text: s.query,
        type: 'recent' as const,
      })),
    [savedSearchesData?.searches],
  );

  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.length < 2) {
      setSuggestions([]);
      return;
    }

    // Filter saved searches that match the current query
    const matchingRecent = recentSavedSearches.filter((s) =>
      s.text.toLowerCase().includes(text.toLowerCase()),
    );

    try {
      const data = await api.ai.smartSearch(text, true) as unknown as SmartSearchSuggestionsResponse;
      const aiSuggestions: SearchSuggestion[] = (data.suggestions || []).map(
        (s: string, i: number) => ({
          id: `ai-${i}`,
          text: s,
          type: 'ai' as const,
        }),
      );
      setSuggestions([...matchingRecent, ...aiSuggestions]);
    } catch {
      setSuggestions(matchingRecent);
    }
  }, [recentSavedSearches]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (searchText?: string) => {
    const text = searchText || query.trim();
    if (!text) return;

    setIsSearching(true);
    setIsOpen(false);

    try {
      const data = await api.ai.smartSearch(text);
      setResult({
        query: text,
        interpretation: data.interpretation || '',
        resultCount: data.resultCount || 0,
      });
      onSearch?.(text);
    } catch {
      // Silent fail — search still attempted
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Search input */}
      <div className="dark:border-dark-border dark:bg-dark-bg-tertiary flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
        {isSearching ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#4f6ef7]" />
        ) : (
          <Sparkles className="h-4 w-4 text-[#4f6ef7]" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Keresés természetes nyelven... pl. 'Raiffeisen emailek múlt hónapból'"
          className="dark:text-dark-text min-w-0 flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none dark:placeholder-gray-500"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResult(null);
              setSuggestions([]);
            }}
            className="dark:text-dark-text-muted dark:hover:text-dark-text text-gray-400 hover:text-gray-600"
            aria-label="Keresés törlése"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => handleSearch()}
          disabled={!query.trim() || isSearching}
          className="rounded-lg bg-[#4f6ef7] p-1.5 text-white transition-colors hover:bg-[#3d5ce5] disabled:opacity-50"
          aria-label="Keresés"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => {
                setQuery(suggestion.text);
                handleSearch(suggestion.text);
              }}
              className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              {suggestion.type === 'recent' ? (
                <Clock className="h-4 w-4 flex-shrink-0 text-gray-400" />
              ) : (
                <Sparkles className="h-4 w-4 flex-shrink-0 text-[#4f6ef7]" />
              )}
              <span className="truncate">{suggestion.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Result & save as workflow */}
      {result && (
        <div className="dark:bg-dark-bg-tertiary dark:border-dark-border mt-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="dark:text-dark-text text-sm font-medium text-gray-800">
                {result.resultCount} találat
              </p>
              {result.interpretation && (
                <p className="dark:text-dark-text-muted mt-0.5 text-xs text-gray-500">
                  Értelmezés: {result.interpretation}
                </p>
              )}
            </div>
            {onSaveAsWorkflowStep && (
              <button
                onClick={() => onSaveAsWorkflowStep(result.query)}
                className="flex items-center gap-1.5 rounded-lg border border-[#4f6ef7]/30 bg-[#4f6ef7]/10 px-3 py-1.5 text-xs font-medium text-[#4f6ef7] transition-colors hover:bg-[#4f6ef7]/20 dark:border-[#4f6ef7]/20 dark:text-[#6d8cff]"
              >
                <Workflow className="h-3.5 w-3.5" />
                Mentés mint workflow lépés
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
