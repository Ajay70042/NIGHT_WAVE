import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

import { ErrorBoundary } from "./components/ErrorBoundary.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// Register Service Worker for PWA (background audio + offline app shell)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[NightWave SW] Registered:", reg.scope);
        // Trigger immediate update check on each page load
        reg.update();
      })
      .catch((err) => {
        console.warn("[NightWave SW] Registration failed:", err);
      });
  });
}
