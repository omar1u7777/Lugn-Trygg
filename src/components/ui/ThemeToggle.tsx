/**
 * Theme Toggle Component - Lugn & Trygg Design System
 * Accessible theme switcher with proper ARIA labels and keyboard support
 */

import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { isDarkMode, toggleTheme } = useTheme();

  const handleToggle = () => {
    toggleTheme();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTheme();
    }
  };

  return (
    <Tooltip
      title={isDarkMode ? 'Växla till ljust läge' : 'Växla till mörkt läge'}
      placement="bottom"
    >
      <IconButton
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-label={isDarkMode ? 'Växla till ljust läge' : 'Växla till mörkt läge'}
        aria-pressed={isDarkMode}
        className="theme-toggle focus-ring"
        size="large"
        sx={{
          color: 'text.primary',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: '2px',
          },
        }}
      >
        {isDarkMode ? <Brightness7 /> : <Brightness4 />}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;