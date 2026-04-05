import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase-config';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('lugn-trygg-theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }

    // Default to light mode on first visit for consistent auth entry experience.
    return false;
  });

  // [U3] Track the Firebase UID of the currently signed-in user.
  // We use a ref (not state) so changes don't trigger additional re-renders.
  const uidRef = useRef<string | null>(null);

  // [U3] When the user signs in, load their saved theme from Firestore so the
  // preference follows them across devices. Uses merge:true so we never overwrite
  // unrelated user fields.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const previousUid = uidRef.current;
      uidRef.current = firebaseUser?.uid ?? null;

      if (firebaseUser && !previousUid) {
        // User just signed in — fetch their saved theme preference.
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          const savedTheme = snap.data()?.preferences?.theme as string | undefined;
          if (savedTheme === 'dark' || savedTheme === 'light') {
            setIsDarkMode(savedTheme === 'dark');
          }
        } catch {
          // Firestore unavailable — localStorage value is the fallback.
        }
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    // Update DOM class for Tailwind CSS dark mode
    if (isDarkMode) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }

    // Persist theme preference
    localStorage.setItem('lugn-trygg-theme', isDarkMode ? 'dark' : 'light');

  }, [isDarkMode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't manually set a preference
      const savedTheme = localStorage.getItem('lugn-trygg-theme');
      if (!savedTheme) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);

    // [U3] Persist the new preference to Firestore when a user is signed in,
    // so it roams to other devices. localStorage (set by the existing useEffect)
    // remains the fast local fallback.
    const uid = uidRef.current;
    if (uid) {
      setDoc(
        doc(db, 'users', uid),
        { preferences: { theme: next ? 'dark' : 'light' } },
        { merge: true }
      ).catch(() => {
        // Firestore write failed (e.g. offline) — localStorage still persists locally.
      });
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={isDarkMode ? 'dark' : 'light'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </ThemeContext.Provider>
  );
};