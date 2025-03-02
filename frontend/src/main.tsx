import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App"; 

/**
 *  Huvudstartfil för Lugn & Trygg Desktop-App
 * -------------------------------------------------
 * - Använder React 18:s `createRoot` för optimerad rendering.
 * - Inkluderar `StrictMode` för att upptäcka eventuella problem i utvecklingsläge.
 * - `BrowserRouter` möjliggör navigation och skyddade rutter.
 * - `AuthProvider` hanterar global autentisering.
 */

const rootElement = document.getElementById("root");

//  Kontrollera att root-elementet finns i `index.html`
if (!rootElement) {
  console.error("❌ Root-elementet saknas i index.html! Kontrollera att <div id='root'></div> finns.");
  throw new Error("Root-element saknas i index.html!");
}

//  Skapa en React 18 root-instans och rendera appen
ReactDOM.createRoot(rootElement).render(
  <StrictMode> {/* 🚀 Aktiverar extra varningar i utvecklingsläge */}
    <BrowserRouter> {/* 🔗 Hanterar navigering i appen */}
      <AuthProvider> {/* 🔒 Tillhandahåller global autentisering */}
        <App /> {/* 🎉 Rendera huvudapplikationen */}
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
