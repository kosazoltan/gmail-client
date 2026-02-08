import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="dark:bg-dark-bg-tertiary flex items-center gap-1 rounded-lg bg-gray-100 p-1">
      <button
        onClick={() => setTheme('light')}
        className={`rounded-md p-2 transition-colors ${
          theme === 'light'
            ? 'dark:bg-dark-bg-tertiary bg-white text-yellow-500 shadow-sm'
            : 'dark:text-dark-text-secondary dark:hover:text-dark-text text-gray-500 hover:text-gray-700'
        }`}
        title="Világos mód"
        aria-label="Világos mód"
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`rounded-md p-2 transition-colors ${
          theme === 'system'
            ? 'dark:bg-dark-bg-tertiary bg-white text-[#4f6ef7] shadow-sm'
            : 'dark:text-dark-text-secondary dark:hover:text-dark-text text-gray-500 hover:text-gray-700'
        }`}
        title="Rendszer beállítás"
        aria-label="Rendszer beállítás"
      >
        <Monitor className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`rounded-md p-2 transition-colors ${
          theme === 'dark'
            ? 'dark:bg-dark-bg-tertiary bg-white text-indigo-500 shadow-sm'
            : 'dark:text-dark-text-secondary dark:hover:text-dark-text text-gray-500 hover:text-gray-700'
        }`}
        title="Sötét mód"
        aria-label="Sötét mód"
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}
