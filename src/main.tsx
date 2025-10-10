import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { LogoProvider } from "./context/LogoContext";
import { AuthProvider } from "./context/AuthContext";
import { SidebarProvider } from "./context/SidebarContext";
import { NotificationProvider } from "./context/NotificationContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <LogoProvider>
        <AuthProvider>
          <SidebarProvider>
            <NotificationProvider>
              <App />
            </NotificationProvider>
          </SidebarProvider>
        </AuthProvider>
      </LogoProvider>
    </ThemeProvider>
  </StrictMode>
);
