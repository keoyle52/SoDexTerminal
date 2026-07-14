import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background text-text-primary text-center">
          <div className="p-4 rounded-full bg-danger/10 border border-danger/25 mb-4 text-danger animate-pulse">
            <ShieldAlert size={36} />
          </div>
          <h2 className="text-base font-bold text-text-primary mb-2">Something went wrong</h2>
          <p className="text-xs text-text-secondary max-w-md mb-6 leading-relaxed">
            An unexpected error occurred while rendering this page. You can try refreshing the page to recover.
          </p>
          {this.state.error && (
            <pre className="text-[10px] text-danger bg-danger/5 border border-danger/20 p-3 rounded-lg max-w-lg overflow-auto font-mono mb-6 text-left w-full">
              {this.state.error.toString()}
            </pre>
          )}
          <Button variant="primary" icon={<RefreshCw size={14} />} onClick={this.handleReset}>
            Reload Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
