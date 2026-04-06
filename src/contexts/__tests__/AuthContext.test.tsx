import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '../../types';

const {
  navigateMock,
  logoutUserMock,
  refreshAccessTokenMock,
  tokenSetAccessTokenMock,
  tokenClearTokensMock,
  secureGetItemMock,
  secureSetItemMock,
  secureRemoveItemMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  logoutUserMock: vi.fn(),
  refreshAccessTokenMock: vi.fn(),
  tokenSetAccessTokenMock: vi.fn(),
  tokenClearTokensMock: vi.fn(),
  secureGetItemMock: vi.fn(),
  secureSetItemMock: vi.fn(),
  secureRemoveItemMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../api/auth', () => ({
  logoutUser: logoutUserMock,
  refreshAccessToken: refreshAccessTokenMock,
}));

vi.mock('../../utils/secureStorage', () => ({
  tokenStorage: {
    setAccessToken: tokenSetAccessTokenMock,
    clearTokens: tokenClearTokensMock,
  },
  secureStorage: {
    getItem: secureGetItemMock,
    setItem: secureSetItemMock,
    removeItem: secureRemoveItemMock,
  },
}));

vi.mock('../../components/Auth/ConsentModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>consent-modal</div> : null),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { AuthProvider, useAuth } from '../AuthContext';

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const sampleUser: User = {
  user_id: 'user-1',
  email: 'user@example.com',
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    secureGetItemMock.mockResolvedValue(null);
    secureSetItemMock.mockResolvedValue(undefined);
    secureRemoveItemMock.mockResolvedValue(undefined);
    tokenSetAccessTokenMock.mockResolvedValue(undefined);
    tokenClearTokensMock.mockReturnValue(undefined);
    logoutUserMock.mockResolvedValue(undefined);
    refreshAccessTokenMock.mockResolvedValue(null);
  });

  it('initializes without persisted auth data', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isLoggedIn).toBe(false);
  });

  it('restores saved user and refreshes access token', async () => {
    secureGetItemMock.mockResolvedValueOnce(JSON.stringify(sampleUser));
    refreshAccessTokenMock.mockResolvedValueOnce('refreshed-token');

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoggedIn).toBe(true);
    });

    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(result.current.user).toEqual(sampleUser);
    expect(result.current.token).toBe('refreshed-token');
  });

  it('clears stale user when refresh token fails', async () => {
    secureGetItemMock.mockResolvedValueOnce(JSON.stringify(sampleUser));
    refreshAccessTokenMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(secureRemoveItemMock).toHaveBeenCalledWith('user');
  });

  it('supports legacy login signature with email and userId', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    await act(async () => {
      await result.current.login('access-token', 'legacy@example.com', 'legacy-id');
    });

    expect(tokenSetAccessTokenMock).toHaveBeenCalledWith('access-token');
    expect(secureSetItemMock).toHaveBeenCalledWith(
      'user',
      JSON.stringify({ email: 'legacy@example.com', user_id: 'legacy-id' })
    );
    expect(result.current.user).toEqual({ email: 'legacy@example.com', user_id: 'legacy-id' });
    expect(result.current.isLoggedIn).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });

  it('supports object-based login signature', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    await act(async () => {
      await result.current.login('obj-token', sampleUser);
    });

    expect(tokenSetAccessTokenMock).toHaveBeenCalledWith('obj-token');
    expect(secureSetItemMock).toHaveBeenCalledWith('user', JSON.stringify(sampleUser));
    expect(result.current.user).toEqual(sampleUser);
    expect(result.current.token).toBe('obj-token');
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });

  it('rethrows login errors and does not navigate', async () => {
    tokenSetAccessTokenMock.mockRejectedValueOnce(new Error('set token failed'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    await expect(result.current.login('bad-token', sampleUser)).rejects.toThrow('set token failed');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('logs out and clears local auth state', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    await act(async () => {
      await result.current.login('token-to-clear', sampleUser);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(logoutUserMock).toHaveBeenCalledTimes(1);
    expect(tokenClearTokensMock).toHaveBeenCalledTimes(1);
    expect(secureRemoveItemMock).toHaveBeenCalledWith('user');
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isLoggedIn).toBe(false);
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  it('still clears local state when remote logout fails', async () => {
    logoutUserMock.mockRejectedValueOnce(new Error('remote logout failed'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    await act(async () => {
      await result.current.login('token-to-clear', sampleUser);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(tokenClearTokensMock).toHaveBeenCalledTimes(1);
    expect(secureRemoveItemMock).toHaveBeenCalledWith('user');
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  it('uses e2e auth payload from localStorage on loopback hosts', async () => {
    localStorage.setItem('__e2e_test_auth__', JSON.stringify({
      token: 'e2e-token',
      user: sampleUser,
    }));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.token).toBe('e2e-token');
    expect(result.current.user).toEqual(sampleUser);
    expect(result.current.isLoggedIn).toBe(true);
    expect(secureGetItemMock).not.toHaveBeenCalled();
  });
});
