import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";
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
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
