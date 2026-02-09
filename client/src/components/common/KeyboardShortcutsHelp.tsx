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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="dark:bg-dark-bg-secondary mx-4 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fejléc */}
        <div className="dark:border-dark-border flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <Keyboard className="h-5 w-5 text-blue-500" />
            <h2 className="dark:text-dark-text text-lg font-semibold text-gray-900">
              Billentyűparancsok
            </h2>
          </div>
          <button
            onClick={onClose}
            className="dark:hover:bg-dark-bg-tertiary dark:text-dark-text-secondary rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tartalom */}
        <div className="max-h-[60vh] overflow-auto px-6 py-4">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h3 className="dark:text-dark-text-muted mb-3 text-sm font-medium text-gray-500">
                  {section.category}
                </h3>
                <div className="space-y-2">
                  {section.items.map((shortcut) => (
                    <div key={shortcut.key} className="flex items-center justify-between">
                      <span className="dark:text-dark-text text-sm text-gray-700">
                        {shortcut.description}
                      </span>
                      <kbd className="dark:bg-dark-bg-tertiary dark:text-dark-text-secondary dark:border-dark-border rounded border border-gray-200 bg-gray-100 px-2 py-1 font-mono text-xs text-gray-600">
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
        <div className="dark:bg-dark-bg-tertiary dark:border-dark-border border-t border-gray-200 bg-gray-50 px-6 py-3">
          <p className="dark:text-dark-text-muted text-center text-xs text-gray-400">
            Nyomd meg az{' '}
            <kbd className="dark:bg-dark-bg rounded bg-gray-200 px-1 py-0.5 text-xs">Esc</kbd>{' '}
            gombot a bezáráshoz
          </p>
        </div>
      </div>
    </div>
  );
}
