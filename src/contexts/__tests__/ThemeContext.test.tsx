/**
 * ThemeContext Tests
 * Covers: ThemeProvider, useTheme hook, dark mode toggle, persistence.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

import { ThemeProvider, useTheme } from '../ThemeContext';

describe('ThemeContext', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
    };
  })();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
    localStorageMock.clear();
    vi.clearAllMocks();
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
  });

  it('useTheme throws when used outside ThemeProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow();
    consoleSpy.mockRestore();
  });

  it('defaults to light mode when no saved preference', () => {
    // Mock matchMedia to return false (light preference)
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as any;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDarkMode).toBe(false);
  });

  it('reads dark mode from localStorage', () => {
    localStorageMock.getItem.mockReturnValue('dark');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDarkMode).toBe(true);
  });

  it('reads light mode from localStorage', () => {
    localStorageMock.getItem.mockReturnValue('light');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDarkMode).toBe(false);
  });

  it('toggleTheme switches dark mode and persists', () => {
    localStorageMock.getItem.mockReturnValue('light');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.isDarkMode).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('renders children', () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Hello</div>
      </ThemeProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
