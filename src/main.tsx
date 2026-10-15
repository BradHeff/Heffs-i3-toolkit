import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import App from "./App";
import theme from "./theme";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: "JetBrains Mono, monospace",
            color: "#E6EDF3",
            background: "#0B0E11",
            minHeight: "100vh",
            whiteSpace: "pre-wrap",
          }}
        >
          <h1 style={{ fontFamily: "inherit" }}>The cockpit went dark.</h1>
          <p>Something crashed the interface. The details below are the trail:</p>
          <pre>{this.state.error.stack ?? this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
