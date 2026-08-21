import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[NightWave ErrorBoundary caught]", error, errorInfo);
  }

  handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    if ("caches" in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "#08080c",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "Inter, sans-serif",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: "420px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
              padding: "28px",
              backdropFilter: "blur(20px)",
            }}
          >
            <h2 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", marginBottom: "20px" }}>
              A cached script or state error was encountered. Resetting the app cache will fix this.
            </p>
            <button
              onClick={this.handleReset}
              style={{
                backgroundColor: "#a3e635",
                color: "#000",
                fontWeight: "600",
                fontSize: "14px",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Clear Cache & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
