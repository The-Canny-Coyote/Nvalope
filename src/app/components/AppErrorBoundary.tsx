/**
 * Error boundary for the main app content. Catches render errors in the tree
 * and shows a simple fallback so one failing component does not take down the whole app.
 * Does not log raw errors or user data (Canny Coyote Ethos).
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

export interface AppErrorBoundaryProps {
  children: ReactNode;
  /** Optional: custom fallback (e.g. for section-level boundary). */
  fallback?: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Do not log raw errors or user data; ethos-compliant.
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          className="flex min-h-[40vh] flex-col items-center justify-center gap-4 bg-background p-6"
          role="alert"
          aria-live="assertive"
          aria-label="Application error"
        >
          <p className="text-sm font-medium text-foreground text-center max-w-md">
            Something went wrong. Try reloading the page.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
