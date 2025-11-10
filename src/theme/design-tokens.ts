/**
 * Enhanced Design Tokens - Complete Design System
 * Extended from base tokens with component-specific tokens
 * 
 * Usage: import { designTokens } from '@/theme/design-tokens';
 */

import { spacing, colors, typography, shadows, borderRadius, transitions } from './tokens';

export * from './tokens'; // Re-export base tokens

// ==========================================
// COMPONENT-SPECIFIC TOKENS
// ==========================================

export const componentTokens = {
  // Dashboard Components
  dashboard: {
    heroGradient: (theme: 'light' | 'dark') =>
      theme === 'dark'
        ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
        : 'linear-gradient(135deg, #3498db 0%, #9b59b6 100%)',
    cardHoverShadow: shadows.lg,
    cardTransition: transitions.card,
    quickActionCard: {
      padding: spacing.xl,
      borderRadius: borderRadius.lg,
      hoverScale: 1.02,
    },
    statCard: {
      minHeight: 140,
      iconSize: 40,
      titleSize: typography.fontSize.lg,
      valueSize: typography.fontSize.xxl,
    },
    progressBar: {
      height: 8,
      borderRadius: borderRadius.xl,
    },
  },

  // Card Components
  card: {
    default: {
      padding: spacing.xl,
      borderRadius: borderRadius.lg,
      shadow: shadows.sm,
      hoverShadow: shadows.md,
    },
    elevated: {
      padding: spacing.xxl,
      borderRadius: borderRadius.xl,
      shadow: shadows.md,
      hoverShadow: shadows.lg,
    },
    interactive: {
      cursor: 'pointer',
      transition: transitions.card,
      hoverTransform: 'translateY(-4px)',
    },
  },

  // Button Components
  button: {
    primary: {
      background: colors.primary.main,
      color: colors.primary.contrast,
      padding: '12px 24px',
      borderRadius: borderRadius.md,
      fontSize: typography.fontSize.md,
      fontWeight: typography.fontWeight.semibold,
      shadow: shadows.sm,
      hoverShadow: shadows.md,
    },
    secondary: {
      background: colors.secondary.main,
      color: colors.secondary.contrast,
      padding: '12px 24px',
      borderRadius: borderRadius.md,
    },
    ghost: {
      background: 'transparent',
      color: colors.text.primary,
      border: `2px solid ${colors.border.default}`,
      hoverBackground: colors.background.elevated,
    },
  },

  // Input Components
  input: {
    default: {
      padding: '12px 16px',
      borderRadius: borderRadius.md,
      border: `1px solid ${colors.border.default}`,
      focusBorder: `2px solid ${colors.primary.main}`,
      fontSize: typography.fontSize.md,
    },
    large: {
      padding: '16px 20px',
      borderRadius: borderRadius.lg,
      fontSize: typography.fontSize.lg,
    },
  },

  // Modal Components
  modal: {
    overlay: {
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
    },
    content: {
      borderRadius: borderRadius.xl,
      shadow: shadows.xxl,
      maxWidth: 600,
      padding: spacing.xxl,
    },
  },

  // Navigation Components
  navigation: {
    height: 64,
    background: colors.background.paper,
    shadow: shadows.sm,
    linkPadding: '8px 16px',
    linkHoverBackground: colors.background.elevated,
  },

  // Mood Components
  mood: {
    emojiSize: {
      sm: 32,
      md: 48,
      lg: 64,
      xl: 80,
    },
    cardPadding: spacing.lg,
    scaleHover: 1.1,
    transition: transitions.button,
  },

  // Chart Components
  chart: {
    height: {
      sm: 200,
      md: 300,
      lg: 400,
    },
    padding: spacing.lg,
    gridColor: colors.border.light,
    tooltipBackground: colors.background.paper,
  },

  // Alert Components
  alert: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    iconSize: 24,
    success: {
      background: colors.success.light + '20', // 20% opacity
      border: colors.success.main,
      color: colors.success.dark,
    },
    error: {
      background: colors.error.light + '20',
      border: colors.error.main,
      color: colors.error.dark,
    },
    warning: {
      background: colors.warning.light + '20',
      border: colors.warning.main,
      color: colors.warning.dark,
    },
    info: {
      background: colors.info.light + '20',
      border: colors.info.main,
      color: colors.info.dark,
    },
  },

  // Badge Components
  badge: {
    small: {
      padding: '2px 8px',
      fontSize: typography.fontSize.xs,
      borderRadius: borderRadius.sm,
    },
    medium: {
      padding: '4px 12px',
      fontSize: typography.fontSize.sm,
      borderRadius: borderRadius.md,
    },
    large: {
      padding: '6px 16px',
      fontSize: typography.fontSize.md,
      borderRadius: borderRadius.lg,
    },
  },

  // Loading Components
  loading: {
    spinnerSize: {
      sm: 16,
      md: 32,
      lg: 48,
    },
    spinnerColor: colors.primary.main,
    skeletonBackground: colors.background.elevated,
    skeletonAnimation: 'pulse 1.5s ease-in-out infinite',
  },
} as const;

// ==========================================
// LAYOUT TOKENS
// ==========================================

export const layoutTokens = {
  maxWidth: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    xxl: 1536,
  },
  container: {
    padding: {
      mobile: spacing.md,
      tablet: spacing.lg,
      desktop: spacing.xl,
    },
  },
  section: {
    spacing: {
      sm: spacing.xl,
      md: spacing.xxl,
      lg: spacing.xxxl,
    },
  },
  grid: {
    gap: {
      sm: spacing.md,
      md: spacing.lg,
      lg: spacing.xl,
    },
    columns: {
      mobile: 1,
      tablet: 2,
      desktop: 3,
      wide: 4,
    },
  },
} as const;

// ==========================================
// ANIMATION TOKENS
// ==========================================

export const animationTokens = {
  fadeIn: {
    keyframes: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    duration: transitions.duration.normal,
    timing: transitions.easing.easeInOut,
  },
  slideUp: {
    keyframes: {
      from: { transform: 'translateY(20px)', opacity: 0 },
      to: { transform: 'translateY(0)', opacity: 1 },
    },
    duration: transitions.duration.normal,
    timing: transitions.easing.easeOut,
  },
  scaleIn: {
    keyframes: {
      from: { transform: 'scale(0.9)', opacity: 0 },
      to: { transform: 'scale(1)', opacity: 1 },
    },
    duration: transitions.duration.fast,
    timing: transitions.easing.easeOut,
  },
  pulse: {
    keyframes: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.5 },
    },
    duration: '1.5s',
    timing: 'ease-in-out',
    iteration: 'infinite',
  },
} as const;

// ==========================================
// RESPONSIVE BREAKPOINTS
// ==========================================

export const breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const;

export const mediaQueries = {
  mobile: `@media (max-width: ${breakpoints.sm - 1}px)`,
  tablet: `@media (min-width: ${breakpoints.sm}px) and (max-width: ${breakpoints.lg - 1}px)`,
  desktop: `@media (min-width: ${breakpoints.lg}px)`,
  wide: `@media (min-width: ${breakpoints.xl}px)`,
  retina: '@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)',
} as const;

// ==========================================
// ACCESSIBILITY TOKENS
// ==========================================

export const a11yTokens = {
  focusRing: {
    width: 2,
    style: 'solid',
    color: colors.primary.main,
    offset: 2,
  },
  minTouchTarget: 44, // iOS minimum
  minClickTarget: 48, // Material Design minimum
  contrast: {
    minimum: 4.5, // WCAG AA for normal text
    enhanced: 7, // WCAG AAA for normal text
  },
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
  notification: 1080,
} as const;

// ==========================================
// COMPLETE DESIGN SYSTEM EXPORT
// ==========================================

export const designTokens = {
  spacing,
  colors,
  typography,
  shadows,
  borderRadius,
  transitions,
  components: componentTokens,
  layout: layoutTokens,
  animation: animationTokens,
  breakpoints,
  mediaQueries,
  a11y: a11yTokens,
  zIndex,
} as const;

export default designTokens;
