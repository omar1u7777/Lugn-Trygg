import { renderHook } from '@testing-library/react';
import { vi, describe, test, expect } from 'vitest';
import { AuthProvider } from '../../contexts/AuthContext';
import useAuth from '../useAuth';

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  AuthContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    Consumer: ({ children }: { children: (value: any) => React.ReactNode }) => children({}),
  },
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('useAuth', () => {
  test('should throw error when used outside AuthProvider', () => {
    // Mock console.error to avoid noise in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth måste användas inom en <AuthProvider>');

    consoleSpy.mockRestore();
  });

  test('should return auth context when used within AuthProvider', () => {
    const mockAuthContext = {
      user: { email: 'test@example.com' },
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
    };

    // Mock the context to return our mock auth context
    vi.mocked(require('../../contexts/AuthContext')).AuthContext.Consumer = ({ children }: { children: (value: any) => React.ReactNode }) =>
      children(mockAuthContext);

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider>
          {children}
        </AuthProvider>
      ),
    });

    expect(result.current).toEqual(mockAuthContext);
  });
});