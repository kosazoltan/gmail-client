import { useNavigate } from 'react-router-dom';
import { Search, Menu, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useSession, useSyncAccount } from '../../hooks/useAccounts';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggleSidebar: () => void;
}

export function Header({ searchQuery, onSearchChange, onToggleSidebar }: HeaderProps) {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const syncAccount = useSyncAccount();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      onSearchChange(localQuery.trim());
      navigate(`/search?q=${encodeURIComponent(localQuery.trim())}`);
    }
  };

  const handleSync = () => {
    if (session?.activeAccountId) {
      syncAccount.mutate({ accountId: session.activeAccountId });
    }
  };

  return (
    <header className="flex items-center gap-4 bg-white border-b border-gray-200 px-4 py-2.5">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Keresőbar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Keresés a levelekben..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-lg text-sm focus:bg-white focus:border-blue-300 focus:ring-1 focus:ring-blue-300 outline-none transition-colors"
          />
        </div>
      </form>

      {/* Szinkronizálás gomb */}
      {session?.authenticated && (
        <button
          onClick={handleSync}
          disabled={syncAccount.isPending}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50"
          title="Levelek szinkronizálása"
        >
          <RefreshCw
            className={`h-5 w-5 ${syncAccount.isPending ? 'animate-spin' : ''}`}
          />
        </button>
      )}
    </header>
  );
}
