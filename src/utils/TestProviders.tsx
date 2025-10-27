import React from "react";
import { BrowserRouter } from "react-router-dom";  // Importera BrowserRouter
import { AuthProvider } from "../contexts/AuthContext"; // Din AuthProvider-komponent
import { ThemeProvider } from "../contexts/ThemeContext";
import "../i18n"; // Initialize i18n
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";

// Force Swedish for tests before rendering
i18n.changeLanguage('sv');

// Seed a dummy authenticated user and mark onboarding as complete for tests
const TEST_USER = { email: 'test@example.com', user_id: 'test-user' };
try {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify(TEST_USER));
    localStorage.setItem(`onboarding_${TEST_USER.user_id}_complete`, 'true');
  }
} catch {}

const TestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>  {/* Lägg till BrowserRouter här för att tillhandahålla routing */}
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </I18nextProvider>
  );
};

export default TestProviders;
