import React from "react";
import { BrowserRouter } from "react-router-dom";  // Importera BrowserRouter
import { AuthProvider } from "../contexts/AuthContext"; // Din AuthProvider-komponent

const TestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter>  {/* Lägg till BrowserRouter här för att tillhandahålla routing */}
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );
};

export default TestProviders;
