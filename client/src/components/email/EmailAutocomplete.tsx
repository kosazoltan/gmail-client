import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../../lib/api';
import type { Contact } from '../../types';

interface EmailAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function EmailAutocomplete({
  value,
  onChange,
  placeholder,
  className = '',
}: EmailAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Az utolsó beírt cím kinyerése (vesszővel elválasztott lista esetén)
  const currentInput = useMemo(() => {
    const parts = value.split(',');
    return parts[parts.length - 1].trim();
  }, [value]);

  // Keresés kontaktok között
  useEffect(() => {
    if (currentInput.length < 1) {
      // Cleanup timer callback-ben történik, nem szinkron setState
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await api.contacts.search(currentInput, 8);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setSelectedIndex(0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      // Cleanup-kor állítjuk vissza
      setSuggestions([]);
      setShowSuggestions(false);
    };
  }, [currentInput]);

  // Kívülre kattintás kezelése
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Javaslat kiválasztása
  const selectSuggestion = (contact: Contact) => {
    const parts = value.split(',').map((p) => p.trim());
    parts[parts.length - 1] = contact.name
      ? `${contact.name} <${contact.email}>`
      : contact.email;
    onChange(parts.join(', '));
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // Billentyűzet kezelése
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
      case 'Tab':
        if (suggestions[selectedIndex]) {
          e.preventDefault();
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        placeholder={placeholder}
        className={`w-full ${className}`}
        autoComplete="off"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-lg max-h-64 overflow-auto">
          {suggestions.map((contact, index) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => selectSuggestion(contact)}
              className={`w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary flex flex-col ${
                index === selectedIndex ? 'bg-blue-50 dark:bg-blue-500/20' : ''
              }`}
            >
              {contact.name ? (
                <>
                  <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
                    {contact.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-dark-text-muted">{contact.email}</span>
                </>
              ) : (
                <span className="text-sm text-gray-900 dark:text-dark-text">{contact.email}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
