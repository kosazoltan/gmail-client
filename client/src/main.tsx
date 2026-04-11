import React from 'react';
import ReactDOM from 'react-dom/client';
import { initSentry } from './utils/sentry';
initSentry(); // Must initialize before App loads
import App from './App';
import './index.css';
import { setupErrorReporter } from './components/ErrorReporter';
import { ErrorBoundary } from './components/ErrorBoundary';

// Initialize global error reporter before rendering
setupErrorReporter();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
