import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import { InstallPrompt } from './components/pwa/InstallPrompt';
import { ToastContainer } from './components/common/ToastContainer';
import { Suspense, lazy } from 'react';
import { LoadingSkeleton } from './components/common/LoadingSkeleton';

// Lazy loaded views — code splitting
const InboxView = lazy(() => import('./components/views/InboxView').then(m => ({ default: m.InboxView })));
const UnifiedInboxView = lazy(() => import('./components/views/UnifiedInboxView').then(m => ({ default: m.UnifiedInboxView })));
const BySenderView = lazy(() => import('./components/views/BySenderView').then(m => ({ default: m.BySenderView })));
const ByTopicView = lazy(() => import('./components/views/ByTopicView').then(m => ({ default: m.ByTopicView })));
const ByTimeView = lazy(() => import('./components/views/ByTimeView').then(m => ({ default: m.ByTimeView })));
const CategoryView = lazy(() => import('./components/views/CategoryView').then(m => ({ default: m.CategoryView })));
const PersonalView = lazy(() => import('./components/views/PersonalView').then(m => ({ default: m.PersonalView })));
const InvoicesView = lazy(() => import('./components/views/InvoicesView').then(m => ({ default: m.InvoicesView })));
const TrashView = lazy(() => import('./components/views/TrashView').then(m => ({ default: m.TrashView })));
const LabelView = lazy(() => import('./components/views/LabelView').then(m => ({ default: m.LabelView })));
const AttachmentsView = lazy(() => import('./components/views/AttachmentsView').then(m => ({ default: m.AttachmentsView })));
const RemindersView = lazy(() => import('./components/views/RemindersView').then(m => ({ default: m.RemindersView })));
const NewslettersView = lazy(() => import('./components/views/NewslettersView').then(m => ({ default: m.NewslettersView })));
const SearchResults = lazy(() => import('./components/views/SearchResults').then(m => ({ default: m.SearchResults })));
const EmailCompose = lazy(() => import('./components/email/EmailCompose').then(m => ({ default: m.EmailCompose })));
const DatabaseManager = lazy(() => import('./components/database/DatabaseManager').then(m => ({ default: m.DatabaseManager })));
const SettingsView = lazy(() => import('./components/views/SettingsView').then(m => ({ default: m.SettingsView })));
const ScheduledView = lazy(() => import('./components/views/ScheduledView').then(m => ({ default: m.ScheduledView })));
const PrivacyPolicy = lazy(() => import('./components/pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./components/pages/TermsOfService').then(m => ({ default: m.TermsOfService })));
const DashboardView = lazy(() => import('./components/views/DashboardView').then(m => ({ default: m.DashboardView })));
const CalendarView = lazy(() => import('./components/views/CalendarView').then(m => ({ default: m.CalendarView })));
const TasksView = lazy(() => import('./components/views/TasksView').then(m => ({ default: m.TasksView })));
const MarketAnalysisView = lazy(() => import('./components/views/MarketAnalysisView').then(m => ({ default: m.MarketAnalysisView })));
const SmartFoldersView = lazy(() => import('./components/views/SmartFoldersView').then(m => ({ default: m.SmartFoldersView })));
const AIAssistantView = lazy(() => import('./components/ai/AIAssistantView').then(m => ({ default: m.AIAssistantView })));
const WorkflowBuilder = lazy(() => import('./components/ai/WorkflowBuilder').then(m => ({ default: m.WorkflowBuilder })));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Suspense fallback={<LoadingSkeleton />}><DashboardView /></Suspense>} />
                <Route path="/calendar" element={<Suspense fallback={<LoadingSkeleton />}><CalendarView /></Suspense>} />
                <Route path="/tasks" element={<Suspense fallback={<LoadingSkeleton />}><TasksView /></Suspense>} />
                <Route path="/market" element={<Suspense fallback={<LoadingSkeleton />}><MarketAnalysisView /></Suspense>} />
                <Route path="/smart-folders" element={<Suspense fallback={<LoadingSkeleton />}><SmartFoldersView /></Suspense>} />
                <Route path="/ai-assistant" element={<Suspense fallback={<LoadingSkeleton />}><AIAssistantView /></Suspense>} />
                <Route path="/ai-workflows" element={<Suspense fallback={<LoadingSkeleton />}><WorkflowBuilder /></Suspense>} />

                <Route path="/" element={<Suspense fallback={<LoadingSkeleton />}><InboxView /></Suspense>} />
                <Route path="/unified" element={<Suspense fallback={<LoadingSkeleton />}><UnifiedInboxView /></Suspense>} />
                <Route path="/by-sender" element={<Suspense fallback={<LoadingSkeleton />}><BySenderView /></Suspense>} />
                <Route path="/by-topic" element={<Suspense fallback={<LoadingSkeleton />}><ByTopicView /></Suspense>} />
                <Route path="/by-time" element={<Suspense fallback={<LoadingSkeleton />}><ByTimeView /></Suspense>} />
                <Route path="/by-category" element={<Suspense fallback={<LoadingSkeleton />}><CategoryView /></Suspense>} />
                <Route path="/personal" element={<Suspense fallback={<LoadingSkeleton />}><PersonalView /></Suspense>} />
                <Route path="/invoices" element={<Suspense fallback={<LoadingSkeleton />}><InvoicesView /></Suspense>} />
                <Route path="/trash" element={<Suspense fallback={<LoadingSkeleton />}><TrashView /></Suspense>} />
                <Route path="/label/:labelId" element={<Suspense fallback={<LoadingSkeleton />}><LabelView /></Suspense>} />
                <Route path="/attachments" element={<Suspense fallback={<LoadingSkeleton />}><AttachmentsView /></Suspense>} />
                <Route path="/reminders" element={<Suspense fallback={<LoadingSkeleton />}><RemindersView onEmailSelect={() => {}} /></Suspense>} />
                <Route path="/newsletters" element={<Suspense fallback={<LoadingSkeleton />}><NewslettersView onEmailSelect={() => {}} /></Suspense>} />
                <Route path="/search" element={<Suspense fallback={<LoadingSkeleton />}><SearchResults /></Suspense>} />
                <Route path="/compose" element={<Suspense fallback={<LoadingSkeleton />}><EmailCompose /></Suspense>} />
                <Route path="/database" element={<Suspense fallback={<LoadingSkeleton />}><DatabaseManager /></Suspense>} />
                <Route path="/settings" element={<Suspense fallback={<LoadingSkeleton />}><SettingsView /></Suspense>} />
                <Route path="/scheduled" element={<Suspense fallback={<LoadingSkeleton />}><ScheduledView /></Suspense>} />
                <Route path="/privacy" element={<Suspense fallback={<LoadingSkeleton />}><PrivacyPolicy /></Suspense>} />
                <Route path="/terms" element={<Suspense fallback={<LoadingSkeleton />}><TermsOfService /></Suspense>} />
              </Route>
            </Routes>
            <InstallPrompt />
            <ToastContainer />
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;