import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { KeyboardShortcutsHelp } from '../common/KeyboardShortcutsHelp';
import { OfflineBanner } from '../common/OfflineBanner';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Reszponzív sidebar kezelés
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Mobilon alapból csukva, desktopon nyitva
      if (mobile) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobilon kattintás a háttérre bezárja a sidebárt
  const handleOverlayClick = () => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="dark:bg-dark-bg flex h-screen overflow-hidden bg-gray-50/80">
      {/* Mobil overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={` ${isMobile ? 'fixed inset-y-0 left-0 z-30' : 'relative'} ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'} transition-transform duration-200`}
      >
        <Sidebar
          isOpen={sidebarOpen || isMobile}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onShowShortcuts={() => setShowShortcutsHelp(true)}
        />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
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
