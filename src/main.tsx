import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import App from "./App";
import "./index.css";

// Production safety handlers to prevent right-click context menus and unwanted keyboard reloads/inspect triggers
if (import.meta.env.PROD) {
  // Disable right-click context menu
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // Disable common browser-level debug triggers
  document.addEventListener('keydown', (e) => {
    // Disable F5, Ctrl+R, Cmd+R (Reloading native webview)
    if (
      e.key === 'F5' ||
      ((e.ctrlKey || e.metaKey) && e.key === 'r')
    ) {
      e.preventDefault();
    }
    // Disable F12, Ctrl+Shift+I, Cmd+Option+I (Inspect Element / DevTools)
    if (
      e.key === 'F12' ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') ||
      ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'i')
    ) {
      e.preventDefault();
    }
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
