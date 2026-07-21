import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { StatusView } from './StatusView';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

/** 렌더 도중 발생한 예기치 못한 예외를 잡아 오류 화면으로 대체한다. */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[AppErrorBoundary]', error, info.componentStack);
    }
  }

  private handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="store-main">
          <StatusView
            variant="error"
            onRetry={this.handleRetry}
            retryLabel="새로고침"
          />
        </main>
      );
    }
    return this.props.children;
  }
}
