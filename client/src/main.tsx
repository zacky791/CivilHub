import React, { type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ToastProvider } from "./components/ui";
import "./styles.css";
class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("CivilHub:", error, info.componentStack);
  }
  render() {
    if (this.state.error)
      return (
        <div className="error-page">
          <h1>We couldn’t open your workspace.</h1>
          <p>{this.state.error}</p>
          <p>
            Check that browser storage is available, then reload. Your saved
            records have not been overwritten.
          </p>
          <button
            className="button button-primary"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
