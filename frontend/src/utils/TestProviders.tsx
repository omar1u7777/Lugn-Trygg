import React from "react";
import { BrowserRouter } from "react-router-dom";  // Importera BrowserRouter
import { AuthProvider } from "../contexts/AuthContext"; // Din AuthProvider-komponent
import "../i18n"; // Initialize i18n
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";

// Force Swedish for tests before rendering
i18n.changeLanguage('sv');

const TestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>  {/* Lägg till BrowserRouter här för att tillhandahålla routing */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </I18nextProvider>
  );
};

export default TestProviders;
