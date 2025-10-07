import { useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import type { AuthContextProps } from "../types/AuthTypes"; //  Korrekt import av typer

//  Hook för att hantera autentisering i hela applikationen
const useAuth = (): AuthContextProps => {
  const context = useContext(AuthContext); //  Hämta det globala autentiseringsobjektet

  //  Om `useAuth` används utanför en <AuthProvider>, kasta ett fel
  if (!context) {
    throw new Error("useAuth måste användas inom en <AuthProvider>");
  }

  return context; //  Returnera det autentiseringsobjekt som hämtats från `AuthContext`
};

export default useAuth;