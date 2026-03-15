import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[RoadmapHub] Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "16px",
          background: "#fee2e2",
          border: "1px solid #ef4444",
          borderRadius: "8px",
          color: "#991b1b",
          fontSize: "14px",
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 999999,
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
        }}>
          <strong>[RoadmapHub] Something went wrong</strong>
          <p style={{ margin: "8px 0 0", fontSize: "12px", opacity: 0.8 }}>
            {this.state.error?.message}
          </p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            style={{ 
              marginTop: "8px", 
              background: "#ef4444", 
              color: "white", 
              border: "none", 
              padding: "4px 8px", 
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Reset
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
