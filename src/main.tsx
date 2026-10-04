import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { STORAGE_KEY } from "./store";
import "./styles.css";

/** If something on a screen breaks, offer a way out instead of a blank page. */
class Recover extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app">
        <h1>Something went wrong</h1>
        <p className="lead">The saved outage on this device couldn't be read.</p>
        <button type="button" className="primary" onClick={() => {
          try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
          window.location.hash = "/";
          window.location.reload();
        }}>Start over</button>
      </main>
    );
  }
}

// Saved on the device so the app opens with no connection (public/sw.js). Not in development, where files change.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Recover>
      <App />
    </Recover>
  </StrictMode>,
);
