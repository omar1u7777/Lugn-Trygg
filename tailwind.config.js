/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Lugn & Trygg - Calm Therapeutic Palette
        primary: {
          50: '#f0f9f7',
          100: '#dcf2ed',
          200: '#b9e5db',
          300: '#8cd3c4',
          400: '#5bbaa8',
          500: '#2c8374',  /* Main teal */
          600: '#1e5f54',
          700: '#1a4d45',
          800: '#173d38',
          900: '#143330',
        },
        secondary: {
          50: '#fdf8f3',
          100: '#f9ece0',
          200: '#f2d9c1',
          300: '#e8c19a',
          400: '#d4a373',
          500: '#c08a5d',  /* Warm sand */
          600: '#8f6a4a',
          700: '#6b503a',
          800: '#4a382a',
          900: '#2d221a',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',  /* Warm amber */
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        info: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#a8e6cf',  /* Soft mint */
          400: '#6ee7b7',
          500: '#34d399',
          600: '#10b981',
          700: '#059669',
          800: '#047857',
          900: '#065f46',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#ffd8a8',  /* Warm peach */
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          50: '#fff5f5',
          100: '#ffe0e0',
          200: '#ffb3ba',  /* Gentle coral */
          300: '#ffc9c9',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        calm: {
          50: '#fff7f0',   /* Warm cream - main background */
          100: '#fffaf5',  /* Warm white */
          200: '#f2e4d4',  /* Beige border */
          300: '#e8dcd0',  /* Medium beige */
          400: '#a89f97',  /* Warm gray */
          500: '#7e6f64',  /* Medium brown-gray */
          600: '#6d645d',  /* Secondary text */
          700: '#4d473f',  /* Darker brown */
          800: '#2f2a24',  /* Primary text */
          900: '#1a1714',  /* Darkest */
        },
        earth: {
          50: '#f3ede7',
          100: '#e5dbce',
          200: '#d6c6b5',
          300: '#c6b09b',
          400: '#b49982',
          500: '#9d8169',
          600: '#7f6651',
          700: '#5f4b3b',
          800: '#3d3025',
          900: '#231b15',
        },
        terracotta: {
          50: '#fef4ee',
          100: '#fde5d5',
          200: '#f7cdb2',
          300: '#efb18d',
          400: '#e29069',
          500: '#cf6b3e',
          600: '#b0522c',
          700: '#8b4022',
          800: '#5b2816',
          900: '#33160c',
        },
        mist: {
          50: '#f5efe7',
          100: '#e6ddd1',
          200: '#d7c9bb',
          300: '#c8b6a5',
          400: '#b9a28f',
          500: '#a88d79',
          600: '#8a7261',
          700: '#695547',
          800: '#463830',
          900: '#261f1b',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '100': '25rem',
        '112': '28rem',
        '128': '32rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in',
        'fade-out': 'fadeOut 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'bounce-slow': 'bounce 2s infinite',
        'wave': 'wave 2s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      animationDelay: {
        '100': '100ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
        '700': '700ms',
        '1000': '1000ms',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        wave: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-15deg)' },
          '75%': { transform: 'rotate(15deg)' },
        },
      },
      boxShadow: {
        'soft': '0 2px 15px 0 rgba(0, 0, 0, 0.05)',
        'medium': '0 4px 20px 0 rgba(0, 0, 0, 0.1)',
        'hard': '0 10px 40px 0 rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
