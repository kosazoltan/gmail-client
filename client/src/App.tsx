import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { InboxView } from './components/views/InboxView';
import { BySenderView } from './components/views/BySenderView';
import { ByTopicView } from './components/views/ByTopicView';
import { ByTimeView } from './components/views/ByTimeView';
import { CategoryView } from './components/views/CategoryView';
import { SearchResults } from './components/views/SearchResults';
import { EmailCompose } from './components/email/EmailCompose';

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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<InboxView />} />
            <Route path="/by-sender" element={<BySenderView />} />
            <Route path="/by-topic" element={<ByTopicView />} />
            <Route path="/by-time" element={<ByTimeView />} />
            <Route path="/by-category" element={<CategoryView />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/compose" element={<EmailCompose />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
