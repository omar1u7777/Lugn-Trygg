/**
 * Tests for auth API functions.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/api/constants', () => ({
  API_ENDPOINTS: {
    AUTH: {
      LOGIN: '/api/v1/auth/login',
      REGISTER: '/api/v1/auth/register',
      LOGOUT: '/api/v1/auth/logout',
      REFRESH_TOKEN: '/api/v1/auth/refresh',
      RESET_PASSWORD: '/api/v1/auth/reset-password',
      CHANGE_EMAIL: '/api/v1/auth/change-email',
      CHANGE_PASSWORD: '/api/v1/auth/change-password',
      SETUP_2FA: '/api/v1/auth/2fa/setup',
      VERIFY_2FA_SETUP: '/api/v1/auth/2fa/verify',
      EXPORT_DATA: '/api/v1/auth/export',
      DELETE_ACCOUNT: '/api/v1/auth/delete',
      CSRF_TOKEN: '/api/v1/auth/csrf-token',
    },
  },
}));

vi.mock('@/utils/secureStorage', () => ({
  tokenStorage: {
    setAccessToken: vi.fn().mockResolvedValue(undefined),
    clearTokens: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { api } from '@/api/client';
import { tokenStorage } from '@/utils/secureStorage';
import {
  loginUser,
  registerUser,
  logoutUser,
  refreshAccessToken,
  resetPassword,
  changeEmail,
  changePassword,
  setup2FA,
  verify2FASetup,
  deleteAccount,
  getCsrfToken,
  csrfManager,
} from '../auth';

const mockApi = api as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const validLoginData = {
  accessToken: 'tok-123',
  user: { id: 'u1', email: 'user@example.com' },
  userId: 'u1',
};

describe('loginUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Provide CSRF token response after login
    mockApi.get.mockResolvedValue({ data: { data: { csrfToken: 'csrf-tok' } } });
  });

  it('returns validated login response on success', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: validLoginData } });

    const result = await loginUser('user@example.com', 'password');
    expect(result.accessToken).toBe('tok-123');
    expect(result.userId).toBe('u1');
  });

  it('calls setAccessToken with the access token', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: validLoginData } });

    await loginUser('user@example.com', 'password');
    expect(tokenStorage.setAccessToken).toHaveBeenCalledWith('tok-123');
  });

  it('throws AuthError when response is missing accessToken', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { user: { id: 'u1' }, userId: 'u1' } } });

    await expect(loginUser('user@example.com', 'password')).rejects.toThrow();
  });

  it('throws AuthError when response is missing user', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { accessToken: 'tok', userId: 'u1' } } });

    await expect(loginUser('user@example.com', 'password')).rejects.toThrow();
  });

  it('throws after non-retryable API failure', async () => {
    const axiosError = { isAxiosError: true, response: { status: 401, data: { message: 'Unauthorized' } }, message: 'Unauthorized' };
    mockApi.post.mockRejectedValue(axiosError);

    await expect(loginUser('user@example.com', 'wrong-pass')).rejects.toThrow();
  });

  it('handles response without data wrapper', async () => {
    mockApi.post.mockResolvedValueOnce({ data: validLoginData });

    const result = await loginUser('user@example.com', 'password');
    expect(result.accessToken).toBe('tok-123');
  });
});

describe('registerUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns user data on success', async () => {
    const userData = { user: { id: 'u2', email: 'new@example.com' } };
    mockApi.post.mockResolvedValueOnce({ data: { data: userData } });

    const result = await registerUser('new@example.com', 'Password1!');
    expect(result.user.id).toBe('u2');
  });

  it('includes referralCode in request when provided', async () => {
    const userData = { user: { id: 'u3', email: 'ref@example.com' } };
    mockApi.post.mockResolvedValueOnce({ data: { data: userData } });

    await registerUser('ref@example.com', 'Password1!', 'Alice', 'REF123');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ referral_code: 'REF123' })
    );
  });

  it('throws when response has no user field', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: {} } });

    await expect(registerUser('x@x.com', 'Password1!')).rejects.toThrow();
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Network error'));

    await expect(registerUser('x@x.com', 'Password1!')).rejects.toThrow();
  });
});

describe('logoutUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls clearTokens even when API call fails', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Network error'));

    await logoutUser();
    expect(tokenStorage.clearTokens).toHaveBeenCalled();
  });

  it('resolves successfully on happy path', async () => {
    mockApi.post.mockResolvedValueOnce({ data: {} });

    await expect(logoutUser()).resolves.toBeUndefined();
    expect(tokenStorage.clearTokens).toHaveBeenCalled();
  });
});

describe('refreshAccessToken', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns new access token on success', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { accessToken: 'new-tok' } } });

    const result = await refreshAccessToken();
    expect(result).toBe('new-tok');
    expect(tokenStorage.setAccessToken).toHaveBeenCalledWith('new-tok');
  });

  it('returns null when response is missing accessToken', async () => {
    // This triggers logoutUser internally - need post mock for logout too
    mockApi.post
      .mockResolvedValueOnce({ data: { data: {} } })  // refresh fails (no token)
      .mockResolvedValueOnce({ data: {} });            // logout call

    const result = await refreshAccessToken();
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Network error'));

    const result = await refreshAccessToken();
    expect(result).toBeNull();
  });
});

describe('resetPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns response data on success', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: 'Email sent' } });

    const result = await resetPassword('user@example.com');
    expect(result).toMatchObject({ message: 'Email sent' });
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Not found'));

    await expect(resetPassword('user@example.com')).rejects.toThrow();
  });
});

describe('changeEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts newEmail and password', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { success: true } });

    await changeEmail('new@example.com', 'password');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ newEmail: 'new@example.com', password: 'password' })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Unauthorized'));

    await expect(changeEmail('new@example.com', 'wrong')).rejects.toThrow();
  });
});

describe('changePassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts current_password and new_password', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { success: true } });

    await changePassword('old-pass', 'new-pass');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ current_password: 'old-pass', new_password: 'new-pass' })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Wrong password'));

    await expect(changePassword('wrong', 'new')).rejects.toThrow();
  });
});

describe('setup2FA', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 2FA setup data', async () => {
    const setupData = { qrCode: 'data:image/png;base64,...', secret: 'TOTP_SECRET' };
    mockApi.post.mockResolvedValueOnce({ data: { data: setupData } });

    const result = await setup2FA();
    expect(result).toMatchObject(setupData);
  });

  it('posts method=totp', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: {} } });

    await setup2FA();
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'totp' })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Server error'));

    await expect(setup2FA()).rejects.toThrow();
  });
});

describe('verify2FASetup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns response data and posts code', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { success: true } });

    const result = await verify2FASetup('123456');
    expect(result).toMatchObject({ success: true });
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ code: '123456' })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Invalid code'));

    await expect(verify2FASetup('000000')).rejects.toThrow();
  });
});

describe('deleteAccount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls delete endpoint with userId', async () => {
    mockApi.delete.mockResolvedValueOnce({ data: { success: true } });

    await deleteAccount('user123');
    expect(mockApi.delete).toHaveBeenCalledWith(expect.stringContaining('user123'));
  });

  it('throws when userId is empty', async () => {
    await expect(deleteAccount('')).rejects.toThrow();
  });

  it('throws on API error', async () => {
    mockApi.delete.mockRejectedValueOnce(new Error('Not found'));

    await expect(deleteAccount('user123')).rejects.toThrow();
  });
});

describe('getCsrfToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    csrfManager.clear();
  });

  it('fetches and returns CSRF token', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { csrfToken: 'csrf-abc' } } });

    const token = await getCsrfToken();
    expect(token).toBe('csrf-abc');
  });

  it('uses cached token on second call', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { csrfToken: 'csrf-cached' } } });

    await getCsrfToken();
    await getCsrfToken(); // should use cache
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it('throws when token response is empty', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: {} } });

    await expect(getCsrfToken()).rejects.toThrow();
  });
});
