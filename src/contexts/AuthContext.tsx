import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { logoutUser, refreshAccessToken } from "../api/auth";
import ConsentModal from "../components/Auth/ConsentModal";
import type { AuthContextProps, User } from "../types/index";
import { tokenStorage, secureStorage } from "../utils/secureStorage";
import { logger } from '../utils/logger';

// 🎯 Skapa AuthContext för att hantera autentisering globalt i appen
export const AuthContext = createContext<AuthContextProps | undefined>(undefined);

const readE2ETestAuthPayload = (): { token: string; user: User } | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const host = window.location.hostname;
  const isLocalLoopback =
    host.includes('localhost') ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]';

  if (!isLocalLoopback) {
    return null;
  }

  const raw = localStorage.getItem('__e2e_test_auth__');
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      token?: unknown;
      user?: unknown;
    };

    if (typeof parsed.token !== 'string' || !parsed.user || typeof parsed.user !== 'object') {
      return null;
    }

    const userCandidate = parsed.user as Partial<User>;
    if (typeof userCandidate.user_id !== 'string' || typeof userCandidate.email !== 'string') {
      return null;
    }

    return {
      token: parsed.token,
      user: userCandidate as User,
    };
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
   const initialE2EAuth = readE2ETestAuthPayload();
   const [token, setTokenState] = useState<string | null>(initialE2EAuth?.token ?? null);
   const [user, setUserState] = useState<User | null>(initialE2EAuth?.user ?? null);
   // Internal UI state for initialization and modals
   const [uiState, setUiState] = useState<{
     isInitialized: boolean;
     isConsentModalOpen: boolean;
   }>({
     isInitialized: false,
     isConsentModalOpen: false,
   });

   // Helper functions to update UI state safely
   const setIsInitialized = useCallback((value: boolean) => {
     setUiState(prev => ({ ...prev, isInitialized: value }));
   }, []);

   const setIsConsentModalOpen = useCallback((value: boolean) => {
     setUiState(prev => ({ ...prev, isConsentModalOpen: value }));
   }, []);

   // Ref to track if initialization has been attempted
   const hasInitializedRef = useRef(false);
   const navigate = useNavigate();

  const getE2ETestAuthPayload = useCallback((): { token: string; user: User } | null => {
    return readE2ETestAuthPayload();
  }, []);

  // Restore user profile and try cookie-based refresh to recover in-memory access token.
  useEffect(() => {
    // Prevent multiple initialization attempts
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    const initializeAuth = async () => {
      try {
        const e2eAuth = getE2ETestAuthPayload();
        if (e2eAuth) {
          setTokenState(e2eAuth.token);
          setUserState(e2eAuth.user);
          return;
        }

        const savedUserJson = await secureStorage.getItem('user');
        const userData = savedUserJson ? JSON.parse(savedUserJson) : null;

        if (userData) {
          setUserState(userData);
          const refreshedToken = await refreshAccessToken();

          if (refreshedToken) {
            setTokenState(refreshedToken);
          } else {
            // Cookie session no longer valid; clear stale local user profile.
            setUserState(null);
            await secureStorage.removeItem('user');
          }

          if (import.meta.env.DEV) {
            logger.debug('✅ Auth initialization completed', { restoredUser: !!refreshedToken });
          }
        }
      } catch (error) {
        logger.error('❌ Failed to initialize auth state:', error);
      } finally {
        // Mark as initialized AFTER state has been set
        setTimeout(() => setIsInitialized(true), 0);
      }
    };

    initializeAuth();
  }, [getE2ETestAuthPayload, setIsInitialized]); // Empty behavior but explicit dependency for hook safety

  // 🔑 Kontrollera om användaren är inloggad (memoized for performance)
  const isLoggedIn = useMemo(() => {
    return Boolean(token && user && user.user_id);
  }, [token, user]);

  // 🔓 Hantera inloggning och lagra användarinformation
  const login = useCallback(async (accessToken: string, emailOrUser: string | User, userId?: string) => {
    logger.debug('🔑 AUTH CONTEXT - Login called', { email: typeof emailOrUser === 'string' ? emailOrUser : emailOrUser.email });

    try {
      // Store token securely
      await tokenStorage.setAccessToken(accessToken);
      setTokenState(accessToken);

      // Handle user data
      let userData: User;
      if (typeof emailOrUser === 'string') {
        // Old signature: (token, email, userId)
        userData = {
          email: emailOrUser,
          user_id: userId || ''
        };
      } else {
        // New signature: (token, user)
        userData = emailOrUser;
      }

      setUserState(userData);
      await secureStorage.setItem('user', JSON.stringify(userData));

      logger.debug('✅ AUTH CONTEXT - Login successful:', { userId: userData.user_id });

      // ✅ FIX: Navigate to dashboard after successful login
      navigate("/dashboard");

    } catch (error) {
      logger.error('❌ AUTH CONTEXT - Login failed:', error);
      throw error;
    }
  }, [navigate]);

  // 🚪 Hantera utloggning och rensa användardata
  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.warn("⚠️ Utloggning misslyckades, rensar ändå lokalt.");
      }
    } finally {
      setTokenState(null);
      setUserState(null);
      // Clear secure storage
      tokenStorage.clearTokens();
      // Keep consent_given in localStorage, only clear auth-related items
      secureStorage.removeItem('user');
      navigate("/login");
    }
  }, [navigate]);

  // 📦 Optimera prestanda genom att memo-isera autentiseringskontexten
  const value = useMemo<AuthContextProps>(
    () => ({ 
      user, 
      setUser: setUserState, 
      token, 
      setToken: setTokenState, 
      isLoggedIn, 
      login, 
      logout: handleLogout,
      isInitialized: uiState.isInitialized 
    }),
    [user, token, login, handleLogout, isLoggedIn, uiState.isInitialized]
  );

  const handleConsentClose = () => {
    setIsConsentModalOpen(false);
    navigate("/dashboard");
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {uiState.isConsentModalOpen && user && (
        <ConsentModal
          isOpen={uiState.isConsentModalOpen}
          onClose={handleConsentClose}
          userId={user.user_id}
        />
      )}
    </AuthContext.Provider>
  );
};

// 🏷 Hook för att hämta autentiseringsfunktioner i andra komponenter
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth måste användas inom en AuthProvider");
  }
  return context;
};
