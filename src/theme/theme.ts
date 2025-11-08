/**
 * Material-UI Theme Configuration
 * Lugn & Trygg Design System
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    tertiary: Palette['primary'];
  }
  interface PaletteOptions {
    tertiary?: PaletteOptions['primary'];
  }
}

const themeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: '#1abc9c',      // Teal - Calm, healing
      light: '#48c9b0',
      dark: '#16a085',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#3498db',      // Blue - Trust, stability
      light: '#5dade2',
      dark: '#2980b9',
      contrastText: '#ffffff',
    },
    tertiary: {
      main: '#9b59b6',      // Purple - Mindfulness
      light: '#bb8fce',
      dark: '#8e44ad',
      contrastText: '#ffffff',
    },
    error: {
      main: '#e74c3c',
      light: '#ec7063',
      dark: '#c0392b',
    },
    warning: {
      main: '#f39c12',
      light: '#f8c471',
      dark: '#e67e22',
    },
    success: {
      main: '#27ae60',
      light: '#58d68d',
      dark: '#229954',
    },
    info: {
      main: '#3498db',
      light: '#5dade2',
      dark: '#2471a3',
    },
    background: {
      default: '#f8f9fa',
      paper: '#ffffff',
    },
    text: {
      primary: '#2c3e50',
      secondary: '#7f8c8d',
      disabled: '#bdc3c7',
    },
    divider: '#ecf0f1',
  },

  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },

  shape: {
    borderRadius: 12,
  },

  shadows: [
    'none',
    '0px 2px 4px rgba(0,0,0,0.05)',
    '0px 4px 8px rgba(0,0,0,0.08)',
    '0px 6px 12px rgba(0,0,0,0.1)',
    '0px 8px 16px rgba(0,0,0,0.12)',
    '0px 12px 24px rgba(0,0,0,0.14)',
    '0px 16px 32px rgba(0,0,0,0.16)',
    '0px 20px 40px rgba(0,0,0,0.18)',
    '0px 24px 48px rgba(0,0,0,0.20)',
    '0px 1px 3px rgba(0,0,0,0.12)',
    '0px 2px 6px rgba(0,0,0,0.14)',
    '0px 3px 9px rgba(0,0,0,0.16)',
    '0px 4px 12px rgba(0,0,0,0.18)',
    '0px 5px 15px rgba(0,0,0,0.20)',
    '0px 6px 18px rgba(0,0,0,0.22)',
    '0px 7px 21px rgba(0,0,0,0.24)',
    '0px 8px 24px rgba(0,0,0,0.26)',
    '0px 9px 27px rgba(0,0,0,0.28)',
    '0px 10px 30px rgba(0,0,0,0.30)',
    '0px 12px 36px rgba(0,0,0,0.32)',
    '0px 14px 42px rgba(0,0,0,0.34)',
    '0px 16px 48px rgba(0,0,0,0.36)',
    '0px 18px 54px rgba(0,0,0,0.38)',
    '0px 20px 60px rgba(0,0,0,0.40)',
    '0px 24px 72px rgba(0,0,0,0.42)',
  ],

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 24px',
          fontSize: '1rem',
          fontWeight: 600,
          boxShadow: 'none',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
          },
        },
        sizeSmall: {
          padding: '6px 16px',
          fontSize: '0.875rem',
        },
        sizeLarge: {
          padding: '12px 32px',
          fontSize: '1.125rem',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0px 8px 24px rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            transition: 'all 0.2s ease-in-out',
            '&:hover fieldset': {
              borderColor: '#1abc9c',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#1abc9c',
              borderWidth: 2,
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0px 2px 6px rgba(0,0,0,0.06)',
        },
        elevation2: {
          boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
        },
        elevation3: {
          boxShadow: '0px 6px 16px rgba(0,0,0,0.10)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0px 2px 8px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '1rem',
          minHeight: 48,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          height: 8,
        },
        bar: {
          borderRadius: 8,
        },
      },
    },
  },

  spacing: 8,

  breakpoints: {
    values: {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
};

// Light theme (default)
export const lightTheme = createTheme(themeOptions);

// Dark theme
export const darkTheme = createTheme({
  ...themeOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: '#48c9b0',
      light: '#76d7c4',
      dark: '#1abc9c',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#5dade2',
      light: '#85c1e9',
      dark: '#3498db',
      contrastText: '#ffffff',
    },
    tertiary: {
      main: '#bb8fce',
      light: '#d7bde2',
      dark: '#9b59b6',
      contrastText: '#ffffff',
    },
    background: {
      default: '#1a1a1a',
      paper: '#2d2d2d',
    },
    text: {
      primary: '#ecf0f1',
      secondary: '#bdc3c7',
      disabled: '#7f8c8d',
    },
    divider: '#34495e',
  },
});

export default lightTheme;
