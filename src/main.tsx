import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import { LogoProvider } from "./context/LogoContext";
import { AuthProvider } from "./context/AuthContext";
import { SidebarProvider } from "./context/SidebarContext";
import { NotificationProvider } from "./context/NotificationContext";
import { DataScopeProvider } from "./context/DataScopeContext";
import { migrateLocalStorageForms } from "./utils/migrateLocalStorage";
import "./index.css";

migrateLocalStorageForms();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <DataScopeProvider>
          <LogoProvider>
            <SidebarProvider>
              <NotificationProvider>
                <App />
              </NotificationProvider>
            </SidebarProvider>
          </LogoProvider>
        </DataScopeProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
