import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-dark-bg">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Hiba történt
            </h1>
            <p className="text-gray-600 dark:text-dark-text-muted mb-4">
              {this.state.error?.message || 'Ismeretlen hiba'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
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
