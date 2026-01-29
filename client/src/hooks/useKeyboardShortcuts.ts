import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcutOptions {
  // Navigáció
  onNextEmail?: () => void;
  onPrevEmail?: () => void;
  onOpenEmail?: () => void;

  // Műveletek
  onReply?: () => void;
  onForward?: () => void;
  onToggleStar?: () => void;
  onToggleRead?: () => void;
  onDelete?: () => void;

  // Általános
  onSearch?: () => void;
  onCompose?: () => void;
  onBack?: () => void;
  onShowHelp?: () => void;

  // Bekapcsolva-e
  enabled?: boolean;
}

function isInputFocused(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  // ContentEditable elemek
  if (target.isContentEditable) {
    return true;
  }

  return false;
}

export function useKeyboardShortcuts(options: KeyboardShortcutOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const opts = optionsRef.current;

    // Ha az opció ki van kapcsolva, ne csinálj semmit
    if (opts.enabled === false) return;

    // Ha input mezőben vagyunk, csak az Escape működjön
    if (isInputFocused(e.target)) {
      if (e.key === 'Escape') {
        (e.target as HTMLElement).blur();
        opts.onBack?.();
        e.preventDefault();
      }
      return;
    }

    // Ne kezeljük ha modifier billentyű van lenyomva (Ctrl, Alt, Meta)
    // kivéve a ? jelet ami Shift+/ formában jön
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'j':
        opts.onNextEmail?.();
        e.preventDefault();
        break;

      case 'k':
        opts.onPrevEmail?.();
        e.preventDefault();
        break;

      case 'enter':
        opts.onOpenEmail?.();
        e.preventDefault();
        break;

      case 'r':
        opts.onReply?.();
        e.preventDefault();
        break;

      case 'f':
        opts.onForward?.();
        e.preventDefault();
        break;

      case 's':
        opts.onToggleStar?.();
        e.preventDefault();
        break;

      case 'u':
        opts.onToggleRead?.();
        e.preventDefault();
        break;

      case 'e':
      case 'delete':
      case 'backspace':
        opts.onDelete?.();
        e.preventDefault();
        break;

      case '/':
        opts.onSearch?.();
        e.preventDefault();
        break;

      case 'c':
        opts.onCompose?.();
        e.preventDefault();
        break;

      case 'escape':
        opts.onBack?.();
        e.preventDefault();
        break;

      case '?':
        opts.onShowHelp?.();
        e.preventDefault();
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Hook a keresés input-ra való fókuszáláshoz
export function useSearchFocus() {
  const focusSearch = useCallback(() => {
    const searchInput = document.querySelector('input[placeholder*="Keresés"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }, []);

  return focusSearch;
}
