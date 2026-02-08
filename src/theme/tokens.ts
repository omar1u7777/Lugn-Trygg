/**
 * Design Tokens - Single Source of Truth
 * Lugn & Trygg Design System
 * 
 * ⚠️ DO NOT use hardcoded values in components!
 * Always import from this file.
 * 
 * Usage:
 * import { spacing, colors, typography } from '@/theme/tokens';
 */

// ==========================================
// SPACING SYSTEM (8px base grid)
// ==========================================
export const spacing = {
  // Base unit: 8px
  xs: 4,      // 4px
  sm: 8,      // 8px
  md: 16,     // 16px
  lg: 24,     // 24px
  xl: 32,     // 32px
  xxl: 48,    // 48px
  xxxl: 64,   // 64px
  
  // Semantic spacing
  cardPadding: 32,
  buttonPadding: '10px 24px',
  inputPadding: '12px 16px',
  sectionGap: 48,
  componentGap: 24,
} as const;

// ==========================================
// COLOR SYSTEM
// ==========================================
export const colors = {
  // Primary palette (from theme)
  primary: {
    main: '#1abc9c',
    light: '#48c9b0',
    dark: '#16a085',
    contrast: '#ffffff',
  },
  
  secondary: {
    main: '#3498db',
    light: '#5dade2',
    dark: '#2980b9',
    contrast: '#ffffff',
  },
  
  tertiary: {
    main: '#9b59b6',
    light: '#bb8fce',
    dark: '#8e44ad',
    contrast: '#ffffff',
  },
  
  // Semantic colors
  success: {
    main: '#27ae60',
    light: '#58d68d',
    dark: '#229954',
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
  
  info: {
    main: '#3498db',
    light: '#5dade2',
    dark: '#2471a3',
  },
  
  // Background colors
  background: {
    default: '#f8f9fa',
    paper: '#ffffff',
    elevated: '#ffffff',
    gradient: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)',
  },
  
  // Text colors
  text: {
    primary: '#2c3e50',
    secondary: '#7f8c8d',
    disabled: '#bdc3c7',
    inverse: '#ffffff',
  },
  
  // Mood colors (mapped to design system)
  mood: {
    // Positive moods
    ecstatic: '#10b981',      // Bright green
    happy: '#059669',         // Green
    content: '#0d9488',       // Teal
    
    // Neutral
    neutral: '#6b7280',       // Gray
    
    // Negative moods
    anxious: '#3b82f6',       // Blue
    sad: '#f59e0b',           // Orange
    depressed: '#ef4444',     // Red
    
    // Alternatives (use theme colors instead)
    glad: '#27ae60',          // success.main
    lycklig: '#58d68d',       // success.light
    nöjd: '#48c9b0',          // primary.light
    tacksam: '#1abc9c',       // primary.main
    positiv: '#3498db',       // secondary.main
    ledsen: '#f39c12',        // warning.main
    arg: '#e74c3c',           // error.main
    stressad: '#c0392b',      // error.dark
    deppig: '#9b59b6',        // tertiary.main
    frustrerad: '#8e44ad',    // tertiary.dark
    irriterad: '#2980b9',     // secondary.dark
    orolig: '#5dade2',        // secondary.light
  },
  
  // Overlay colors
  overlay: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.2)',
    heavy: 'rgba(255, 255, 255, 0.3)',
    dark: 'rgba(0, 0, 0, 0.5)',
  },
  
  // Border colors
  border: {
    default: '#ecf0f1',
    light: 'rgba(255, 255, 255, 0.2)',
    dark: '#34495e',
  },
} as const;

// ==========================================
// TYPOGRAPHY SYSTEM
// ==========================================
export const typography = {
  fontFamily: {
    primary: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    monospace: [
      '"Fira Code"',
      '"Courier New"',
      'monospace',
    ].join(','),
  },
  
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    md: '1rem',       // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    xxl: '1.5rem',    // 24px
    xxxl: '2rem',     // 32px
  },
  
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
  },
} as const;

// ==========================================
// BORDER RADIUS SYSTEM
// ==========================================
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
  
  // Component-specific
  button: 10,
  card: 16,
  input: 10,
  chip: 8,
} as const;

// ==========================================
// SHADOW SYSTEM
// ==========================================
export const shadows = {
  none: 'none',
  sm: '0px 2px 4px rgba(0,0,0,0.05)',
  md: '0px 4px 8px rgba(0,0,0,0.08)',
  lg: '0px 6px 12px rgba(0,0,0,0.1)',
  xl: '0px 8px 16px rgba(0,0,0,0.12)',
  xxl: '0px 12px 24px rgba(0,0,0,0.14)',
  
  // Component-specific
  card: '0px 4px 12px rgba(0,0,0,0.08)',
  cardHover: '0px 8px 24px rgba(0,0,0,0.12)',
  button: '0px 2px 6px rgba(0,0,0,0.06)',
  buttonHover: '0px 4px 12px rgba(0,0,0,0.15)',
} as const;

// ==========================================
// ANIMATION/TRANSITION SYSTEM
// ==========================================
export const transitions = {
  duration: {
    fast: '0.15s',
    normal: '0.2s',
    slow: '0.3s',
  },
  
  easing: {
    easeInOut: 'ease-in-out',
    easeOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  
  // Common transitions
  default: 'all 0.2s ease-in-out',
  button: 'all 0.2s ease-in-out',
  card: 'all 0.3s ease-in-out',
} as const;

// ==========================================
// BREAKPOINTS (from theme)
// ==========================================
export const breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

// ==========================================
// Z-INDEX SYSTEM
// ==========================================
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;

// ==========================================
// ICON SIZES
// ==========================================
export const iconSize = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// ==========================================
// CONTAINER SIZES
// ==========================================
export const container = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const;

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get mood color from mood name
 */
export const getMoodColor = (mood: string): string => {
  const moodLower = mood.toLowerCase() as keyof typeof colors.mood;
  return colors.mood[moodLower] || colors.text.secondary;
};

/**
 * Get responsive spacing
 */
export const getResponsiveSpacing = (
  xs: keyof typeof spacing,
  md?: keyof typeof spacing,
  lg?: keyof typeof spacing
) => ({
  xs: spacing[xs],
  md: md ? spacing[md] : spacing[xs],
  lg: lg ? spacing[lg] : (md ? spacing[md] : spacing[xs]),
});

/**
 * Create gradient
 */
export const createGradient = (color1: string, color2: string, angle = 135) => 
  `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;

/**
 * Create rgba from hex color
 */
export const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Export everything as default for convenience
export default {
  spacing,
  colors,
  typography,
  borderRadius,
  shadows,
  transitions,
  breakpoints,
  zIndex,
  iconSize,
  container,
  getMoodColor,
  getResponsiveSpacing,
  createGradient,
  hexToRgba,
};
