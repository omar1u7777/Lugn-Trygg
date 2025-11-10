import React from "react";
import { BrowserRouter } from "react-router-dom";  // Importera BrowserRouter
import { AuthProvider } from "../contexts/AuthContext"; // Din AuthProvider-komponent
import { ThemeProvider } from "../contexts/ThemeContext";
import "../i18n"; // Initialize i18n
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";

// Force Swedish for tests before rendering
i18n.changeLanguage('sv');

// ⚠️ DEVELOPMENT ONLY: Seed test user data for testing
// This code is ONLY executed in test environment and NEVER in production
const TEST_USER = { email: 'test@example.com', user_id: 'test-user' };

// SECURITY: Only inject test data if explicitly enabled AND in test/dev environment
if (typeof window !== 'undefined' && typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
  try {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify(TEST_USER));
    localStorage.setItem(`onboarding_${TEST_USER.user_id}_complete`, 'true');
  } catch (error) {
    console.warn('Failed to seed test data:', error);
  }
}

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
