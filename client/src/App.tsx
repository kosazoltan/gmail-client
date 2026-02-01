import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { InboxView } from './components/views/InboxView';
import { BySenderView } from './components/views/BySenderView';
import { ByTopicView } from './components/views/ByTopicView';
import { ByTimeView } from './components/views/ByTimeView';
import { PersonalView } from './components/views/PersonalView';
import { InvoicesView } from './components/views/InvoicesView';
import { TrashView } from './components/views/TrashView';
import { AttachmentsView } from './components/views/AttachmentsView';
import { RemindersView } from './components/views/RemindersView';
import { NewslettersView } from './components/views/NewslettersView';
import { SearchResults } from './components/views/SearchResults';
import { EmailCompose } from './components/email/EmailCompose';
import { DatabaseManager } from './components/database/DatabaseManager';
import { PrivacyPolicy } from './components/pages/PrivacyPolicy';
import { TermsOfService } from './components/pages/TermsOfService';
import { InstallPrompt } from './components/pwa/InstallPrompt';
import { ToastContainer } from './components/common/ToastContainer';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 másodperc
      retry: 1,
    },
  },
});

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<InboxView />} />
              <Route path="/by-sender" element={<BySenderView />} />
              <Route path="/by-topic" element={<ByTopicView />} />
              <Route path="/by-time" element={<ByTimeView />} />
              <Route path="/personal" element={<PersonalView />} />
              <Route path="/invoices" element={<InvoicesView />} />
              <Route path="/trash" element={<TrashView />} />
              <Route path="/attachments" element={<AttachmentsView />} />
              <Route path="/reminders" element={<RemindersView onEmailSelect={() => {}} />} />
              <Route path="/newsletters" element={<NewslettersView onEmailSelect={() => {}} />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/compose" element={<EmailCompose />} />
              <Route path="/database" element={<DatabaseManager />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
            </Route>
          </Routes>
          <InstallPrompt />
          <ToastContainer />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
