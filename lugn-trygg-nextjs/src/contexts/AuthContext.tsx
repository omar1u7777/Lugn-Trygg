
import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect, useRef, Dispatch, SetStateAction } from "react";
import { useRouter, usePathname } from "next/navigation";

// User and AuthContext types
export interface User {
  email: string;
  user_id: string;
}

export interface AuthContextProps {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  token: string | null;
  setToken: Dispatch<SetStateAction<string | null>>;
  isLoggedIn: () => boolean;
  login: (accessToken: string, email: string, user_id: string) => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextProps | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<User | null>(null);
  const [uiState, setUiState] = useState<{ isInitialized: boolean; isConsentModalOpen: boolean }>({
    isInitialized: false,
    isConsentModalOpen: false,
  });
  const setIsInitialized = useCallback((value: boolean) => {
    setUiState(prev => ({ ...prev, isInitialized: value }));
  }, []);
  const setIsConsentModalOpen = useCallback((value: boolean) => {
    setUiState(prev => ({ ...prev, isConsentModalOpen: value }));
  }, []);
  const hasInitializedRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
    setTokenState(storedToken);
    setUserState(storedUser ? JSON.parse(storedUser) : null);
    if (!storedToken || !storedUser) {
      if (pathname !== '/login' && pathname !== '/register') {
        router.replace("/login");
      }
    }
    setIsInitialized(true);
  }, [router, pathname, setIsInitialized]);

  // TODO: Implement token refresh and logout logic for Next.js

  const isLoggedIn = useCallback(() => Boolean(token && user && user.user_id), [token, user]);
  const login = useCallback((accessToken: string, email: string, user_id: string) => {
    const userData: User = { email, user_id };
    setTokenState(accessToken);
    setUserState(userData);
    if (typeof window !== 'undefined') {
      localStorage.setItem("token", accessToken);
      localStorage.setItem("user", JSON.stringify(userData));
    }
    router.push("/dashboard");
  }, [router]);
  const handleLogout = useCallback(async () => {
    setTokenState(null);
    setUserState(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    router.push("/login");
  }, [router]);
  const value = useMemo<AuthContextProps>(
    () => ({ user, setUser: setUserState, token, setToken: setTokenState, isLoggedIn, login, logout: handleLogout }),
    [user, token, login, handleLogout, isLoggedIn]
  );
  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* ConsentModal and other UI can be added here for Next.js */}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
