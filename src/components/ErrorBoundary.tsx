import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; path?: string };
        if (parsed.error) {
          friendly = `${parsed.error}${parsed.path ? ` (${parsed.path})` : ''}`;
        }
      } catch {
        // Keep original text
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#080a24] text-[#eef0ff]">
          <div className="nv-card max-w-md w-full p-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f06478]/15 text-[#f06478]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="font-display text-lg font-bold">NOVYRA Net — Application Notice</h2>
            <p className="text-xs text-[#cfd3ff] leading-relaxed break-words">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl nv-btn-primary px-4 py-2 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
