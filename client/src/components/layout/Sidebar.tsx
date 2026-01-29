import { NavLink, useNavigate } from 'react-router-dom';
import { useSession, useLogin } from '../../hooks/useAccounts';
import { AccountSwitcher } from '../accounts/AccountSwitcher';
import {
  Inbox,
  Users,
  MessageSquare,
  Clock,
  Tags,
  PenSquare,
  ChevronLeft,
  Plus,
  Mail,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navItems = [
  { path: '/', icon: Inbox, label: 'Beérkezett' },
  { path: '/by-sender', icon: Users, label: 'Küldő szerint' },
  { path: '/by-topic', icon: MessageSquare, label: 'Téma szerint' },
  { path: '/by-time', icon: Clock, label: 'Időszak szerint' },
  { path: '/by-category', icon: Tags, label: 'Kategóriák' },
];

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { data: session } = useSession();
  const login = useLogin();
  const navigate = useNavigate();

  return (
    <aside
      className={cn(
        'flex flex-col bg-white border-r border-gray-200 transition-all duration-200',
        isOpen ? 'w-64' : 'w-16',
      )}
    >
      {/* Logo / Collapse */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        {isOpen && (
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-blue-600" />
            <span className="font-semibold text-gray-800">Gmail Kliens</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ChevronLeft
            className={cn('h-4 w-4 transition-transform', !isOpen && 'rotate-180')}
          />
        </button>
      </div>

      {/* Új levél gomb */}
      <div className="p-3">
        <button
          onClick={() => navigate('/compose')}
          className={cn(
            'flex items-center gap-2 rounded-2xl bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all',
            isOpen ? 'px-6 py-3 w-full justify-center' : 'p-3 mx-auto',
          )}
        >
          <PenSquare className="h-5 w-5" />
          {isOpen && <span className="font-medium">Új levél</span>}
        </button>
      </div>

      {/* Navigáció */}
      <nav className="flex-1 py-2 space-y-1 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                !isOpen && 'justify-center px-2',
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {isOpen && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Fiókkezelés */}
      <div className="border-t border-gray-200 p-3">
        {session?.authenticated ? (
          <AccountSwitcher compact={!isOpen} />
        ) : (
          <button
            onClick={() => login.mutate()}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 w-full',
              !isOpen && 'justify-center px-2',
            )}
          >
            <Plus className="h-5 w-5" />
            {isOpen && <span>Fiók hozzáadása</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
