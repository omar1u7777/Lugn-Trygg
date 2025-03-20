import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logoutUser, refreshAccessToken } from "../api/api";
import type { AuthContextProps, User } from "../types/AuthTypes";

// 🎯 Skapa AuthContext för att hantera autentisering globalt i appen
export const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUserState] = useState<User | null>(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const navigate = useNavigate();

  // ✅ Hämta och validera token & användardata vid start
  useEffect(() => {
    if (!token || !user) {
      console.warn("⚠️ Ingen giltig session hittad, omdirigerar till /login...");
      navigate("/login");
    } else {
      console.log("✅ Token & användare laddad från localStorage:", user);
    }
  }, []);

  // 🔄 Automatisk token-förnyelse (var 14:e minut)
  useEffect(() => {
    if (!token) return;

    const refreshToken = async () => {
      try {
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          setTokenState(newAccessToken);
          localStorage.setItem("token", newAccessToken);
          console.log("🔄 Token förnyad automatiskt.");
        }
      } catch (error) {
        console.warn("⚠️ Token-förnyelse misslyckades, loggar ut användaren.");
        handleLogout();
      }
    };

    const interval = setInterval(refreshToken, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  // 🔑 Kontrollera om användaren är inloggad
  const isLoggedIn = useCallback(() => Boolean(token && user?.user_id), [token, user]);

  // 🔓 Hantera inloggning och lagra användarinformation
  const login = useCallback((accessToken: string, email: string, user_id: string) => {
    const userData: User = { email, user_id };
    setTokenState(accessToken);
    setUserState(userData);

    localStorage.setItem("token", accessToken);
    localStorage.setItem("user", JSON.stringify(userData));
    console.log("✅ Användaren är inloggad:", userData);

    navigate("/dashboard");
  }, [navigate]);

  // 🚪 Hantera utloggning och rensa användardata
  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.warn("⚠️ Utloggning misslyckades, rensar ändå lokalt.");
    } finally {
      setTokenState(null);
      setUserState(null);
      localStorage.clear();
      navigate("/login");
    }
  }, [navigate]);

  // 🚀 Optimera prestanda genom att memo-isera autentiseringskontexten
  const value = useMemo<AuthContextProps>(
    () => ({ user, setUser: setUserState, token, setToken: setTokenState, isLoggedIn, login, logout: handleLogout }),
    [user, token, login, handleLogout, isLoggedIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 🏷 Hook för att hämta autentiseringsfunktioner i andra komponenter
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth måste användas inom en AuthProvider");
  }
  return context;
};
