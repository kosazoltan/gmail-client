import React, { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { isChunkLoadError, lazyWithRetry } from '../lazyWithRetry';

// ─── isChunkLoadError ────────────────────────────────────────────────────────

describe('isChunkLoadError', () => {
  it('"Failed to fetch dynamically imported module" → true', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
  });

  it('"ChunkLoadError: Loading chunk 7 failed" → true', () => {
    expect(isChunkLoadError(new Error('ChunkLoadError: Loading chunk 7 failed'))).toBe(true);
  });

  it('plain string "Failed to fetch dynamically imported module" → true', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(true);
  });

  it('"Cannot read property \'foo\' of undefined" → false', () => {
    expect(isChunkLoadError(new Error("Cannot read property 'foo' of undefined"))).toBe(false);
  });

  it('undefined → false', () => {
    expect(isChunkLoadError(undefined)).toBe(false);
  });

  it('null → false', () => {
    expect(isChunkLoadError(null)).toBe(false);
  });

  it('empty string → false', () => {
    expect(isChunkLoadError('')).toBe(false);
  });
});

// ─── lazyWithRetry ───────────────────────────────────────────────────────────

// Suppress React's console.error for expected error boundary output
const originalConsoleError = console.error;

// Minimal error boundary to catch React lazy errors in tests
class TestErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (err: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onError?: (err: Error) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }
  render() {
    if (this.state.hasError)
      return <div data-testid="error-boundary">error: {this.state.error?.message}</div>;
    return this.props.children;
  }
}

describe('lazyWithRetry', () => {
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Clear sessionStorage between tests
    sessionStorage.clear();

    // Mock window.location.reload - jsdom won't actually reload
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        reload: reloadMock,
      },
    });

    // Suppress React's unhandled error output for expected boundary scenarios
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it('sikeres factory → komponens renderelhető (Suspense + React Testing Library)', async () => {
    const TestComponent = () => <div data-testid="success">Hello from lazy</div>;
    const factory = vi.fn().mockResolvedValue({ default: TestComponent });

    const LazyComp = lazyWithRetry(factory, 'test-success');

    render(
      <Suspense fallback={<div>loading...</div>}>
        <LazyComp />
      </Suspense>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('success')).toBeDefined();
    });
    expect(screen.getByTestId('success').textContent).toBe('Hello from lazy');
  });

  it('factory dob chunk error-t, sessionStorage üres → window.location.reload hívva, flag set', async () => {
    const chunkError = new Error('Failed to fetch dynamically imported module');
    const factory = vi.fn().mockRejectedValue(chunkError);

    const LazyComp = lazyWithRetry(factory, 'test-reload');

    render(
      <Suspense fallback={<div data-testid="fallback">loading...</div>}>
        <TestErrorBoundary>
          <LazyComp />
        </TestErrorBoundary>
      </Suspense>,
    );

    // Wait for reload to be triggered
    await waitFor(() => {
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    // Flag should be set in sessionStorage
    expect(sessionStorage.getItem('lazyWithRetry:reloaded:test-reload')).toBe('1');
  });

  it('factory dob chunk error-t, flag MÁR set → reload NEM hívva, hiba újra-dobva', async () => {
    // Pre-set the "already reloaded" flag
    sessionStorage.setItem('lazyWithRetry:reloaded:test-already-reloaded', '1');

    const chunkError = new Error('Failed to fetch dynamically imported module');
    const factory = vi.fn().mockRejectedValue(chunkError);

    const LazyComp = lazyWithRetry(factory, 'test-already-reloaded');

    let caughtError: Error | null = null;

    render(
      <Suspense fallback={<div data-testid="fallback">loading...</div>}>
        <TestErrorBoundary
          onError={(err) => {
            caughtError = err;
          }}
        >
          <LazyComp />
        </TestErrorBoundary>
      </Suspense>,
    );

    // Error boundary should catch the re-thrown error
    await waitFor(() => {
      expect(screen.getByTestId('error-boundary')).toBeDefined();
    });

    // reload should NOT have been called
    expect(reloadMock).not.toHaveBeenCalled();

    // The error should be the original chunk error
    expect(caughtError).not.toBeNull();
    expect((caughtError as unknown as Error).message).toContain(
      'Failed to fetch dynamically imported module',
    );
  });
});
