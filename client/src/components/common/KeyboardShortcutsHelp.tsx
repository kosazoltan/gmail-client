import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  description: string;
}

const shortcuts: { category: string; items: ShortcutItem[] }[] = [
  {
    category: 'Navigáció',
    items: [
      { key: 'J', description: 'Következő levél' },
      { key: 'K', description: 'Előző levél' },
      { key: 'Enter', description: 'Levél megnyitása' },
      { key: 'Esc', description: 'Vissza / Bezárás' },
    ],
  },
  {
    category: 'Levelezés',
    items: [
      { key: 'C', description: 'Új levél írása' },
      { key: 'R', description: 'Válasz' },
      { key: 'F', description: 'Továbbítás' },
    ],
  },
  {
    category: 'Műveletek',
    items: [
      { key: 'S', description: 'Csillagozás' },
      { key: 'U', description: 'Olvasott/olvasatlan' },
      { key: 'E', description: 'Törlés (kukába)' },
    ],
  },
  {
    category: 'Egyéb',
    items: [
      { key: '/', description: 'Keresés' },
      { key: '?', description: 'Billentyűparancsok' },
    ],
  },
];

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-dark-bg-secondary rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fejléc */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <Keyboard className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">
              Billentyűparancsok
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary text-gray-500 dark:text-dark-text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tartalom */}
        <div className="px-6 py-4 max-h-[60vh] overflow-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h3 className="text-sm font-medium text-gray-500 dark:text-dark-text-muted mb-3">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-gray-700 dark:text-dark-text">
                        {shortcut.description}
                      </span>
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-dark-bg-tertiary text-gray-600 dark:text-dark-text-secondary rounded border border-gray-200 dark:border-dark-border">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lábléc */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-dark-bg-tertiary border-t border-gray-200 dark:border-dark-border">
          <p className="text-xs text-gray-400 dark:text-dark-text-muted text-center">
            Nyomd meg az <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-dark-bg rounded text-xs">Esc</kbd> gombot a bezáráshoz
          </p>
        </div>
      </div>
    </div>
  );
}
