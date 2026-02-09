import React from 'react';
import { renderHook } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import useAuth from '../useAuth';
import { AuthContext } from '../../contexts/AuthContext';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should throw error when used outside AuthProvider', () => {
    // Suppress React error boundary / console.error noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth måste användas inom en <AuthProvider>');

    consoleSpy.mockRestore();
  });

  test('should return auth context when used within a provider', () => {
    const mockAuthContext = {
      user: { email: 'test@example.com', user_id: '123' },
      token: 'mock-token',
      login: vi.fn(),
      logout: vi.fn(),
      isLoggedIn: true,
      isInitialized: true,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AuthContext.Provider,
        { value: mockAuthContext as any },
        children
      );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current).toBe(mockAuthContext);
  });
});