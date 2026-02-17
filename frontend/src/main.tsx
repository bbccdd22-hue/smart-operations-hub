import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { OrgsProvider } from "./contexts/OrgsContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App";
import "./styles.css";
import "./i18n";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OrgsProvider>
          <NotificationProvider>
            <ThemeProvider>
            <App />
            </ThemeProvider>
          </NotificationProvider>
        </OrgsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

