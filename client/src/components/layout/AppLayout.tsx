import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { KeyboardShortcutsHelp } from '../common/KeyboardShortcutsHelp';
import { OfflineBanner } from '../common/OfflineBanner';
import { useDesktopNotifications } from '../../hooks/useDesktopNotifications';
import { useSession } from '../../hooks/useAccounts';

const getViewportWidth = () => (typeof window === 'undefined' ? 1280 : window.innerWidth);

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => getViewportWidth() >= 1024);
  const [searchQuery, setSearchQuery] = useState('');
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [isMobile, setIsMobile] = useState(() => getViewportWidth() < 768);
  const [isTablet, setIsTablet] = useState(
    () => getViewportWidth() >= 768 && getViewportWidth() < 1024,
  );
  const location = useLocation();
  const { data: session } = useSession();

  // Real-time new email desktop notifications via SSE
  useDesktopNotifications(!!session?.activeAccountId);

  // Reszponzív sidebar kezelés
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      const tablet = width >= 768 && width < 1024;
      setIsMobile(mobile);
      setIsTablet(tablet);
      if (mobile) setSidebarOpen(false);
      if (!mobile && !tablet) setSidebarOpen(true);
    };

    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobilon navigáláskor automatikusan bezárja a sidebárt
  useEffect(() => {
    if (isMobile) {
      queueMicrotask(() => setSidebarOpen(false));
    }
  }, [location.pathname, isMobile]);

  // Mobilon kattintás a háttérre bezárja a sidebárt
  const handleOverlayClick = () => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="dark:bg-dark-bg flex h-dvh min-h-dvh overflow-hidden bg-gray-50/80">
      {/* Mobil overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={` ${isMobile ? 'fixed inset-y-0 left-0 z-[80]' : 'relative'} ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'} transition-transform duration-200`}
      >
        <Sidebar
          isOpen={sidebarOpen || isTablet || isMobile}
          isMobile={isMobile}
          isTablet={isTablet}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
          onShowShortcuts={() => setShowShortcutsHelp(true)}
        />

        <OfflineBanner />

        <main className="flex-1 overflow-auto">
          <Outlet context={{ searchQuery, showShortcutsHelp, setShowShortcutsHelp }} />
        </main>
      </div>

      {/* Billentyűparancsok súgó (globális, a sidebarról nyitható) */}
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </div>
  );
}
