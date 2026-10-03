import React from "react";
import ReactDOM from "react-dom/client";
import { installGlobalFetchAirGapGate } from "./utils/networkPolicy";

// Initialize early defense-in-depth Air-Gap gate
installGlobalFetchAirGapGate();

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-sans/700.css";

import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";

import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";

import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/500.css";
import "@fontsource/fira-code/600.css";

import App from "./App";
import "./index.css";

if (import.meta.env.PROD) {
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', (e) => {
    if (
      e.key === 'F5' ||
      ((e.ctrlKey || e.metaKey) && e.key === 'r')
    ) {
      e.preventDefault();
    }
    if (
      e.key === 'F12' ||
      ((e.ctrlKey || e.metaKey) && e.key === 'I') ||
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
