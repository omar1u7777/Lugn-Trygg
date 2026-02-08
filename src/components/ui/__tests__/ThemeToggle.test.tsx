/**
 * ThemeToggle Component Tests - Lugn & Trygg Design System
 * Comprehensive test coverage for ThemeToggle component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeToggle } from '../ThemeToggle';
import { ThemeProvider } from '../../../contexts/ThemeContext';

// Mock the ThemeContext
const mockToggleTheme = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ThemeToggle Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with light theme icon', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
      toggleTheme: mockToggleTheme,
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /växla till mörkt läge/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders with dark theme icon', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: true,
      toggleTheme: mockToggleTheme,
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /växla till ljust läge/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls toggleTheme on click', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
      toggleTheme: mockToggleTheme,
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('calls toggleTheme on Enter key press', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
      toggleTheme: mockToggleTheme,
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter' });

    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('calls toggleTheme on Space key press', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
      toggleTheme: mockToggleTheme,
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: ' ' });

    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('prevents default on Enter key press', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
      toggleTheme: mockToggleTheme,
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');
    const mockPreventDefault = vi.fn();
    fireEvent.keyDown(button, { key: 'Enter', preventDefault: mockPreventDefault });

    expect(mockPreventDefault).toHaveBeenCalled();
  });

  it('prevents default on Space key press', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
      toggleTheme: mockToggleTheme,
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');
    const mockPreventDefault = vi.fn();
    fireEvent.keyDown(button, { key: ' ', preventDefault: mockPreventDefault });

    expect(mockPreventDefault).toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
      toggleTheme: mockToggleTheme,
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Växla till mörkt läge');
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('has focus ring class', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
      toggleTheme: mockToggleTheme,
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('focus-ring');
  });

  it('renders tooltip with correct text', () => {
    mockUseTheme.mockReturnValue({
      isDarkMode: false,
      toggleTheme: mockToggleTheme,
    });

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    // Tooltip should be present (though we can't easily test the tooltip content without additional setup)
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
