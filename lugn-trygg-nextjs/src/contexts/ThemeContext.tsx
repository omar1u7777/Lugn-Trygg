
import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { motion, AnimatePresence } from 'framer-motion';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  muiTheme: Theme;
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
  const [isDarkMode, setIsDarkMode] = useState<boolean | null>(null);

  // Only create theme when isDarkMode is set
  const muiTheme = React.useMemo(() =>
    createTheme({
      palette: {
        mode: isDarkMode ? 'dark' : 'light',
        primary: {
          main: isDarkMode ? '#4a9eff' : '#1abc9c',
        },
        secondary: {
          main: isDarkMode ? '#81c784' : '#16a085',
        },
        background: {
          default: isDarkMode ? '#1a1a1a' : '#ecf7fa',
          paper: isDarkMode ? '#2d2d2d' : '#ffffff',
        },
        text: {
          primary: isDarkMode ? '#e0e0e0' : '#2c3e50',
          secondary: isDarkMode ? '#b0b0b0' : '#6c757d',
        },
      },
      typography: {
        fontFamily: '"Arial", sans-serif',
        h1: {
          fontSize: '2.5rem',
          fontWeight: 700,
        },
        h2: {
          fontSize: '2rem',
          fontWeight: 600,
        },
        h3: {
          fontSize: '1.5rem',
          fontWeight: 600,
        },
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              transition: 'all 0.3s ease',
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: '12px',
              boxShadow: isDarkMode
                ? '0 4px 8px rgba(0, 0, 0, 0.3)'
                : '0 4px 8px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.3s ease',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              borderRadius: '12px',
            },
          },
        },
      },
    }), [isDarkMode]);

  // On mount, set theme from localStorage or system
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') setIsDarkMode(true);
      else if (savedTheme === 'light') setIsDarkMode(false);
      else setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode === null) return;
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => (prev === null ? false : !prev));
  };

  // Avoid rendering children until theme is set on client
  if (isDarkMode === null) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, muiTheme }}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        <AnimatePresence mode="wait">
          <motion.div
            key={isDarkMode ? 'dark' : 'light'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
