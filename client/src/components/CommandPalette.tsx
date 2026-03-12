import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Inbox,
  Mail,
  PenSquare,
  Calendar,
  CheckSquare,
  BarChart3,
  Sparkles,
  Settings,
  Users,
  MessageSquare,
  Clock,
  Tags,
  User,
  Receipt,
  Trash2,
  Paperclip,
  Newspaper,
  Bell,
  CalendarClock,
  Database,
  LayoutDashboard,
  FolderSearch,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  category: 'navigation' | 'action' | 'ai';
  keywords?: string[];
  shortcut?: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const commands: CommandItem[] = useMemo(
    () => [
      // Navigation
      { id: 'nav-home', label: 'Dashboard', icon: LayoutDashboard, action: () => { navigate('/dashboard'); close(); }, category: 'navigation', keywords: ['home', 'főoldal', 'kezdőlap'] },
      { id: 'nav-inbox', label: 'Beérkezett', icon: Inbox, action: () => { navigate('/'); close(); }, category: 'navigation', keywords: ['inbox', 'levelek', 'email'] },
      { id: 'nav-compose', label: 'Új levél írása', icon: PenSquare, action: () => { navigate('/compose'); close(); }, category: 'navigation', keywords: ['compose', 'write', 'írás', 'levél'], shortcut: 'C' },
      { id: 'nav-unified', label: 'Minden levél', icon: Mail, action: () => { navigate('/unified'); close(); }, category: 'navigation', keywords: ['unified', 'all', 'összes'] },
      { id: 'nav-calendar', label: 'Naptár', icon: Calendar, action: () => { navigate('/calendar'); close(); }, category: 'navigation', keywords: ['calendar', 'események'] },
      { id: 'nav-tasks', label: 'Feladatok', icon: CheckSquare, action: () => { navigate('/tasks'); close(); }, category: 'navigation', keywords: ['tasks', 'todo', 'teendő'] },
      { id: 'nav-market', label: 'Piaci Elemzés', icon: BarChart3, action: () => { navigate('/market'); close(); }, category: 'navigation', keywords: ['market', 'forex', 'piac'] },
      { id: 'nav-ai', label: 'AI Asszisztens', icon: Sparkles, action: () => { navigate('/ai-assistant'); close(); }, category: 'navigation', keywords: ['ai', 'assistant', 'chat'] },
      { id: 'nav-smart-folders', label: 'Smart Folders', icon: FolderSearch, action: () => { navigate('/smart-folders'); close(); }, category: 'navigation', keywords: ['smart', 'folders', 'mappák'] },
      { id: 'nav-by-sender', label: 'Küldő szerint', icon: Users, action: () => { navigate('/by-sender'); close(); }, category: 'navigation', keywords: ['sender', 'küldő'] },
      { id: 'nav-by-topic', label: 'Téma szerint', icon: MessageSquare, action: () => { navigate('/by-topic'); close(); }, category: 'navigation', keywords: ['topic', 'téma'] },
      { id: 'nav-by-time', label: 'Időszak szerint', icon: Clock, action: () => { navigate('/by-time'); close(); }, category: 'navigation', keywords: ['time', 'időszak'] },
      { id: 'nav-categories', label: 'Kategóriák', icon: Tags, action: () => { navigate('/by-category'); close(); }, category: 'navigation', keywords: ['category', 'kategória'] },
      { id: 'nav-personal', label: 'Személyes', icon: User, action: () => { navigate('/personal'); close(); }, category: 'navigation', keywords: ['personal', 'személyes'] },
      { id: 'nav-invoices', label: 'Számlák', icon: Receipt, action: () => { navigate('/invoices'); close(); }, category: 'navigation', keywords: ['invoices', 'számlák'] },
      { id: 'nav-trash', label: 'Kuka', icon: Trash2, action: () => { navigate('/trash'); close(); }, category: 'navigation', keywords: ['trash', 'kuka', 'törölt'] },
      { id: 'nav-attachments', label: 'Mellékletek', icon: Paperclip, action: () => { navigate('/attachments'); close(); }, category: 'navigation', keywords: ['attachments', 'mellékletek', 'csatolmány'] },
      { id: 'nav-newsletters', label: 'Hírlevelek', icon: Newspaper, action: () => { navigate('/newsletters'); close(); }, category: 'navigation', keywords: ['newsletters', 'hírlevelek'] },
      { id: 'nav-reminders', label: 'Emlékeztetők', icon: Bell, action: () => { navigate('/reminders'); close(); }, category: 'navigation', keywords: ['reminders', 'emlékeztetők'] },
      { id: 'nav-scheduled', label: 'Ütemezett', icon: CalendarClock, action: () => { navigate('/scheduled'); close(); }, category: 'navigation', keywords: ['scheduled', 'ütemezett'] },
      { id: 'nav-database', label: 'Adatbázis', icon: Database, action: () => { navigate('/database'); close(); }, category: 'navigation', keywords: ['database', 'adatbázis', 'db'] },
      { id: 'nav-settings', label: 'Beállítások', icon: Settings, action: () => { navigate('/settings'); close(); }, category: 'navigation', keywords: ['settings', 'beállítások'] },

      // Actions
      { id: 'act-search', label: 'Email keresés', icon: Search, action: () => { navigate('/search'); close(); }, category: 'action', keywords: ['search', 'keresés', 'find'], shortcut: '/' },

      // AI Commands
      { id: 'ai-chat', label: 'AI Chat megnyitása', icon: Sparkles, action: () => { navigate('/ai-assistant'); close(); }, category: 'ai', keywords: ['ai', 'chat', 'kérdés'] },
    ],
    [navigate, close],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.keywords?.some((kw) => kw.includes(q)),
    );
  }, [query, commands]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filtered]);

  const flatFiltered = useMemo(() => filtered, [filtered]);

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K to open
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Navigate list with keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatFiltered[selectedIndex]) {
            flatFiltered[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [flatFiltered, selectedIndex, close],
  );

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-command-item]');
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigáció',
    action: 'Műveletek',
    ai: 'AI Parancsok',
  };

  let globalIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Command Palette */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <Search className="h-5 w-5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Keresés parancsok, oldalak között..."
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
          <kbd className="hidden rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 sm:inline-block dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-auto p-2">
          {flatFiltered.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Nincs találat „{query}" keresésre
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {categoryLabels[category] || category}
                </div>
                {items.map((item) => {
                  const currentIndex = globalIndex++;
                  const isSelected = currentIndex === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      data-command-item
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                        isSelected
                          ? 'bg-[#4f6ef7]/10 text-[#4f6ef7] dark:bg-[#4f6ef7]/20 dark:text-[#6d8cff]'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                      )}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          {item.shortcut}
                        </kbd>
                      )}
                      {isSelected && (
                        <ArrowRight className="h-3.5 w-3.5 text-[#4f6ef7] dark:text-[#6d8cff]" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-gray-200 px-4 py-2 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 bg-gray-100 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800">↑↓</kbd>
            navigáció
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 bg-gray-100 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800">↵</kbd>
            kiválasztás
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 bg-gray-100 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800">esc</kbd>
            bezárás
          </span>
        </div>
      </div>
    </div>
  );
}
