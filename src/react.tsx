import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";

import {
  getDefaultFrontendErrorReporter,
  type FrontendErrorReporter,
} from "./reporter.js";

export interface MerchiErrorBoundaryFallbackProps {
  error: Error;
  reset: () => void;
}

export interface MerchiErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode | ((props: MerchiErrorBoundaryFallbackProps) => ReactNode);
  reporter?: FrontendErrorReporter;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface MerchiErrorBoundaryState {
  error: Error | null;
}

export class MerchiErrorBoundary extends Component<
  MerchiErrorBoundaryProps,
  MerchiErrorBoundaryState
> {
  override state: MerchiErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): MerchiErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const reporter = this.props.reporter ?? getDefaultFrontendErrorReporter();
    const context: Parameters<FrontendErrorReporter["captureException"]>[1] = {
      source: "react_error_boundary",
    };
    if (errorInfo.componentStack) context.componentStack = errorInfo.componentStack;
    reporter?.captureException(error, context);
    try {
      this.props.onError?.(error, errorInfo);
    } catch {
      // Application callbacks must not make the fallback boundary fail.
    }
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const reset = (): void => this.setState({ error: null });
    return typeof this.props.fallback === "function"
      ? this.props.fallback({ error, reset })
      : this.props.fallback;
  }
}
