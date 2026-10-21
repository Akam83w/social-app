import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./social-features.css";
import "./world-class.css";
import "./design-port.css";
import "./theme-real.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";
import { ThemeSync } from "./ThemeToggle";
import { registerServiceWorker } from "./lib/api";
import { startPerformanceMonitoring } from "./lib/performance";

if (typeof window !== "undefined") {
  registerServiceWorker();
  startPerformanceMonitoring();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeSync />
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
