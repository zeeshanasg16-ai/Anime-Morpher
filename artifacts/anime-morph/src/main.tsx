import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RootErrorBoundary] Caught error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#0a0a0f",
            color: "#fff",
            padding: "40px 24px",
            fontFamily: "ui-monospace, monospace",
            fontSize: 14,
          }}
        >
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <h1 style={{ color: "#f87171", fontSize: 20, marginBottom: 12 }}>
              AnimeMorph crashed
            </h1>
            <p style={{ color: "#a1a1aa", marginBottom: 16 }}>
              {this.state.error.message}
            </p>
            <pre
              style={{
                background: "#18181b",
                padding: 16,
                borderRadius: 8,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 12,
                color: "#e4e4e7",
              }}
            >
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                padding: "8px 16px",
                background: "#a855f7",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>,
);
