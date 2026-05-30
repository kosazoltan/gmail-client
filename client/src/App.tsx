import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import { InstallPrompt } from './components/pwa/InstallPrompt';
import { ToastContainer } from './components/common/ToastContainer';
import { Suspense, useEffect } from 'react';
import { lazyWithRetry } from './lib/lazyWithRetry';
import { LockScreen } from './components/auth/LockScreen';
import { useLockScreen } from './hooks/useLockScreen';
import { LoadingSkeleton } from './components/common/LoadingSkeleton';
import { CommandPalette } from './components/CommandPalette';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useSession } from './hooks/useAccounts';
import { warmUpBackend } from './lib/api';

// Lazy loaded views — code splitting with stale-chunk reload recovery (lazyWithRetry)
const InboxView = lazyWithRetry(
  () => import('./components/views/InboxView').then((m) => ({ default: m.InboxView })),
  'InboxView',
);
const UnifiedInboxView = lazyWithRetry(
  () =>
    import('./components/views/UnifiedInboxView').then((m) => ({ default: m.UnifiedInboxView })),
  'UnifiedInboxView',
);
const BySenderView = lazyWithRetry(
  () => import('./components/views/BySenderView').then((m) => ({ default: m.BySenderView })),
  'BySenderView',
);
const ByTopicView = lazyWithRetry(
  () => import('./components/views/ByTopicView').then((m) => ({ default: m.ByTopicView })),
  'ByTopicView',
);
const ByTimeView = lazyWithRetry(
  () => import('./components/views/ByTimeView').then((m) => ({ default: m.ByTimeView })),
  'ByTimeView',
);
const CategoryView = lazyWithRetry(
  () => import('./components/views/CategoryView').then((m) => ({ default: m.CategoryView })),
  'CategoryView',
);
const PersonalView = lazyWithRetry(
  () => import('./components/views/PersonalView').then((m) => ({ default: m.PersonalView })),
  'PersonalView',
);
const InvoicesView = lazyWithRetry(
  () => import('./components/views/InvoicesView').then((m) => ({ default: m.InvoicesView })),
  'InvoicesView',
);
const InvoiceAutomationView = lazyWithRetry(
  () =>
    import('./components/views/InvoiceAutomationView').then((m) => ({
      default: m.InvoiceAutomationView,
    })),
  'InvoiceAutomationView',
);
const TrashView = lazyWithRetry(
  () => import('./components/views/TrashView').then((m) => ({ default: m.TrashView })),
  'TrashView',
);
const LabelView = lazyWithRetry(
  () => import('./components/views/LabelView').then((m) => ({ default: m.LabelView })),
  'LabelView',
);
const AttachmentsView = lazyWithRetry(
  () => import('./components/views/AttachmentsView').then((m) => ({ default: m.AttachmentsView })),
  'AttachmentsView',
);
const RemindersView = lazyWithRetry(
  () => import('./components/views/RemindersView').then((m) => ({ default: m.RemindersView })),
  'RemindersView',
);
const NewslettersView = lazyWithRetry(
  () => import('./components/views/NewslettersView').then((m) => ({ default: m.NewslettersView })),
  'NewslettersView',
);
const SearchResults = lazyWithRetry(
  () => import('./components/views/SearchResults').then((m) => ({ default: m.SearchResults })),
  'SearchResults',
);
const EmailCompose = lazyWithRetry(
  () => import('./components/email/EmailCompose').then((m) => ({ default: m.EmailCompose })),
  'EmailCompose',
);
const DatabaseManager = lazyWithRetry(
  () =>
    import('./components/database/DatabaseManager').then((m) => ({ default: m.DatabaseManager })),
  'DatabaseManager',
);
const SettingsView = lazyWithRetry(
  () => import('./components/views/SettingsView').then((m) => ({ default: m.SettingsView })),
  'SettingsView',
);
const ScheduledView = lazyWithRetry(
  () => import('./components/views/ScheduledView').then((m) => ({ default: m.ScheduledView })),
  'ScheduledView',
);
const PrivacyPolicy = lazyWithRetry(
  () => import('./components/pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })),
  'PrivacyPolicy',
);
const TermsOfService = lazyWithRetry(
  () => import('./components/pages/TermsOfService').then((m) => ({ default: m.TermsOfService })),
  'TermsOfService',
);
const DashboardView = lazyWithRetry(
  () => import('./components/views/DashboardView').then((m) => ({ default: m.DashboardView })),
  'DashboardView',
);
const CalendarView = lazyWithRetry(
  () => import('./components/views/CalendarView').then((m) => ({ default: m.CalendarView })),
  'CalendarView',
);
const TasksView = lazyWithRetry(
  () => import('./components/views/TasksView').then((m) => ({ default: m.TasksView })),
  'TasksView',
);
const MarketAnalysisView = lazyWithRetry(
  () =>
    import('./components/views/MarketAnalysisView').then((m) => ({
      default: m.MarketAnalysisView,
    })),
  'MarketAnalysisView',
);
const SmartFoldersView = lazyWithRetry(
  () =>
    import('./components/views/SmartFoldersView').then((m) => ({ default: m.SmartFoldersView })),
  'SmartFoldersView',
);
const AIAssistantView = lazyWithRetry(
  () => import('./components/ai/AIAssistantView').then((m) => ({ default: m.AIAssistantView })),
  'AIAssistantView',
);
const ThreadView = lazyWithRetry(
  () => import('./components/views/ThreadView').then((m) => ({ default: m.ThreadView })),
  'ThreadView',
);
const AnalyticsView = lazyWithRetry(
  () => import('./components/views/AnalyticsView').then((m) => ({ default: m.AnalyticsView })),
  'AnalyticsView',
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

function App() {
  useOfflineSync();
  const lock = useLockScreen();

  // Warm up backend on app load (wakes Render cold start)
  useEffect(() => {
    warmUpBackend();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        lock.lockNow();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lock]);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AppRoutes />
            <CommandPalette />
            <InstallPrompt />
            <ToastContainer />
            {lock.isLocked && <LockScreen onUnlock={lock.unlock} />}
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const { data: session } = useSession();

  const openEmail = (emailId: string, accountId?: string) => {
    const params = new URLSearchParams({ emailId });
    const resolvedAccountId = accountId || session?.activeAccountId;
    if (resolvedAccountId) {
      params.set('accountId', resolvedAccountId);
    }
    navigate(`/?${params.toString()}`);
  };

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <DashboardView />
            </Suspense>
          }
        />
        <Route
          path="/calendar"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <CalendarView />
            </Suspense>
          }
        />
        <Route
          path="/tasks"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <TasksView />
            </Suspense>
          }
        />
        <Route
          path="/market"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <MarketAnalysisView />
            </Suspense>
          }
        />
        <Route
          path="/analytics"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <AnalyticsView />
            </Suspense>
          }
        />
        <Route
          path="/smart-folders"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <SmartFoldersView onEmailSelect={openEmail} />
            </Suspense>
          }
        />
        <Route
          path="/ai-assistant"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <AIAssistantView />
            </Suspense>
          }
        />
        <Route
          path="/thread/:threadId"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <ThreadView />
            </Suspense>
          }
        />
        <Route
          path="/"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <InboxView />
            </Suspense>
          }
        />
        <Route
          path="/unified"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <UnifiedInboxView />
            </Suspense>
          }
        />
        <Route
          path="/by-sender"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <BySenderView />
            </Suspense>
          }
        />
        <Route
          path="/by-topic"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <ByTopicView />
            </Suspense>
          }
        />
        <Route
          path="/by-time"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <ByTimeView />
            </Suspense>
          }
        />
        <Route
          path="/by-category"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <CategoryView />
            </Suspense>
          }
        />
        <Route
          path="/personal"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <PersonalView />
            </Suspense>
          }
        />
        <Route
          path="/invoices"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <InvoicesView />
            </Suspense>
          }
        />
        <Route
          path="/invoice-automation"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <InvoiceAutomationView />
            </Suspense>
          }
        />
        <Route
          path="/trash"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <TrashView />
            </Suspense>
          }
        />
        <Route
          path="/label/:labelId"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <LabelView />
            </Suspense>
          }
        />
        <Route
          path="/attachments"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <AttachmentsView />
            </Suspense>
          }
        />
        <Route
          path="/reminders"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <RemindersView onEmailSelect={openEmail} />
            </Suspense>
          }
        />
        <Route
          path="/newsletters"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <NewslettersView onEmailSelect={openEmail} />
            </Suspense>
          }
        />
        <Route
          path="/search"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <SearchResults />
            </Suspense>
          }
        />
        <Route
          path="/compose"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <EmailCompose />
            </Suspense>
          }
        />
        <Route
          path="/database"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <DatabaseManager />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <SettingsView />
            </Suspense>
          }
        />
        <Route
          path="/scheduled"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <ScheduledView />
            </Suspense>
          }
        />
        <Route
          path="/privacy"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <PrivacyPolicy />
            </Suspense>
          }
        />
        <Route
          path="/terms"
          element={
            <Suspense fallback={<LoadingSkeleton />}>
              <TermsOfService />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
