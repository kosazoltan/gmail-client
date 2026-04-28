import { Component, ErrorInfo, ReactNode } from 'react';
import { API_BASE } from '../lib/api';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

function reportError(payload: Record<string, unknown>): void {
  try {
    const isProduction =
      window.location.hostname === 'mindenes.org' ||
      window.location.hostname === 'www.mindenes.org';
    if (!isProduction) {
      return;
    }

    const message = typeof payload.message === 'string' ? payload.message : '';
    if (message.includes('Not allowed by CORS')) {
      return;
    }

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `${API_BASE}/error-report`,
        new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      );
    } else {
      fetch(`${API_BASE}/error-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Never throw from error reporter
  }
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
    reportError({
      errorType: 'react_error_boundary',
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      browser: navigator.userAgent,
      timestamp: new Date().toISOString(),
      breadcrumbs: [{ type: 'componentStack', data: errorInfo.componentStack?.slice(0, 500) }],
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="dark:bg-dark-bg flex h-screen items-center justify-center bg-gray-50">
          <div className="p-8 text-center">
            <h1 className="mb-4 text-2xl font-bold text-red-600">Hiba történt</h1>
            <p className="dark:text-dark-text-muted mb-4 text-gray-600">
              {this.state.error?.message || 'Ismeretlen hiba'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              Újratöltés
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
