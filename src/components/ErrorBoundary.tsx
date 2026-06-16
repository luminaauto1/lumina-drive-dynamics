import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

/**
 * Top-level error boundary. Without this, any render error white-screens the
 * whole site. Uses inline styles so the fallback still renders even if the CSS
 * bundle failed to load.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, maxWidth: '30rem', margin: 0 }}>
            This page hit an unexpected error. Please refresh the page — if it keeps happening, get in touch and we'll sort it out.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '0.6rem 1.4rem', borderRadius: '0.5rem', border: '1px solid currentColor', background: 'transparent', cursor: 'pointer', fontSize: '0.95rem' }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
