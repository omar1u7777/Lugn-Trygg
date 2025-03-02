import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../api/api";
import type { AuthContextProps, User } from "../types/AuthTypes";

//  Skapa AuthContext för att hantera autentisering globalt i appen
export const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  //  Tillstånd för användarens token och information
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const navigate = useNavigate(); //  Navigering för att hantera sidomdirigeringar

  //  Synkronisera token och användardata från localStorage vid start
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      try {
        const parsedUser: User = JSON.parse(savedUser);

        if (parsedUser.email && parsedUser.user_id) {
          setTokenState(savedToken);
          setUserState(parsedUser);
          console.log("✅ Token & användare laddad från localStorage:", parsedUser);
          navigate("/dashboard"); // 🚀 Omdirigerar användaren till Dashboard vid start
        } else {
          console.warn("⚠️ Ogiltig user-data i localStorage, rensar...");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      } catch (e) {
        console.error("❌ JSON.parse-fel vid laddning av user-data", e);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }
  }, [navigate]); // Körs vid första renderingen för att hämta lagrade autentiseringsuppgifter

  //  Kontrollera om användaren är inloggad
  const isLoggedIn = useCallback(() => {
    return Boolean(token && user?.user_id);
  }, [token, user]);

  //  Hantera inloggning och lagra användarinformation
  const login = useCallback((accessToken: string, email: string, user_id: string) => {
    const userData: User = { email, user_id };
    setTokenState(accessToken);
    setUserState(userData);

    localStorage.setItem("token", accessToken);
    localStorage.setItem("user", JSON.stringify(userData));
    console.log("✅ Användaren är inloggad:", userData);

    navigate("/dashboard"); // 🚀 Omdirigera användaren till Dashboard efter inloggning
  }, [navigate]);

  //  Hantera utloggning och rensa användardata
  const logout = useCallback(async () => {
    try {
      if (user?.user_id) {
        await logoutUser(user.user_id); // 📡 Anropa backend för att logga ut användaren
      }
    } catch (error) {
      console.warn("⚠️ Utloggning misslyckades, rensar ändå lokalt.");
    } finally {
      setTokenState(null);
      setUserState(null);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/login"); // 🔄 Omdirigera till inloggningssidan
    }
  }, [user, navigate]);

  //  Memoisera värdet för att optimera prestanda och undvika onödiga re-renders
  const value = useMemo<AuthContextProps>(
    () => ({ user, setUser: setUserState, token, setToken: setTokenState, isLoggedIn, login, logout }),
    [user, token, login, logout, isLoggedIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

//  Hook för att hämta autentiseringsfunktioner i andra komponenter
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth måste användas inom en AuthProvider");
  }
  return context;
};
