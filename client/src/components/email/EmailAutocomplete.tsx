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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const currentInput = useMemo(() => {
    const parts = value.split(',');
    return parts[parts.length - 1].trim();
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const results = currentInput.length
          ? await api.contacts.list(currentInput, 8)
          : await api.contacts.frequent(5);
        if (!mountedRef.current) return;
        setSuggestions(results);
        setShowSuggestions(results.length > 0 && document.activeElement === inputRef.current);
        setSelectedIndex(0);
      } catch {
        if (!mountedRef.current) return;
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [currentInput]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applySelection = (displayValue: string) => {
    const parts = value.split(',').map((p) => p.trim());
    parts[parts.length - 1] = displayValue;
    onChange(parts.filter(Boolean).join(', '));
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const selectSuggestion = (contact: Contact) => {
    applySelection(contact.name ? `${contact.name} <${contact.email}>` : contact.email);
  };

  const commitManualValue = () => {
    if (!currentInput) return;
    applySelection(currentInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && suggestions[selectedIndex]) {
        selectSuggestion(suggestions[selectedIndex]);
      } else {
        commitManualValue();
      }
      return;
    }

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

  const handleFocus = async () => {
    if (currentInput.length > 0) {
      setShowSuggestions(suggestions.length > 0);
      return;
    }

    try {
      const frequent = await api.contacts.frequent(5);
      if (!mountedRef.current) return;
      setSuggestions(frequent);
      setSelectedIndex(0);
      setShowSuggestions(frequent.length > 0);
    } catch {
      // ignore
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={`w-full ${className}`}
        autoComplete="off"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="dark:bg-dark-bg-secondary dark:border-dark-border absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((contact, index) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => selectSuggestion(contact)}
              className={`dark:hover:bg-dark-bg-tertiary flex w-full flex-col px-3 py-2 text-left hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-blue-50 dark:bg-blue-500/20' : ''
              }`}
            >
              <span className="dark:text-dark-text text-sm font-medium text-gray-900">
                {contact.name || contact.email}
              </span>
              {contact.name && (
                <span className="dark:text-dark-text-muted text-xs text-gray-500">
                  {contact.email}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
