import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  /** Rendered instead of the children after they throw. */
  fallback: ReactNode;
  /** Changing this clears the error and retries the children. */
  resetKey?: unknown;
  children: ReactNode;
};

type ErrorBoundaryState = { failed: boolean; resetKey: unknown };

/**
 * Contains a failure (e.g. a 3D model that won't load, or a WebGL
 * context that can't be created) so the rest of the page keeps working.
 * Works inside React Three Fiber canvases too.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    return props.resetKey !== state.resetKey
      ? { failed: false, resetKey: props.resetKey }
      : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[fidelio] recovered from a component error:", error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
