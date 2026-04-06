/**
 * Tests for admin API functions.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('../errors', () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ApiError';
    }
    static fromAxiosError(error: unknown) {
      return new ApiError((error as Error).message || 'API error');
    }
  },
}));

vi.mock('../constants', () => ({
  API_ENDPOINTS: {
    ADMIN: {
      PERFORMANCE_METRICS: '/api/v1/admin/metrics',
      STATS: '/api/v1/admin/stats',
      USERS: '/api/v1/admin/users',
      REPORTS: '/api/v1/admin/reports',
      SYSTEM_HEALTH: '/api/v1/admin/health',
    },
  },
}));

import { api } from '../client';
import {
  getPerformanceMetrics,
  getAdminStats,
  getAdminUsers,
  updateUserStatus,
  getContentReports,
  resolveReport,
  getSystemHealth,
} from '../admin';

const mockApi = api as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

describe('getPerformanceMetrics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns metrics data on success', async () => {
    const metrics = { endpoints: {}, totalRequests: 1000, errorCounts: {}, slowRequestsCount: 5 };
    mockApi.get.mockResolvedValueOnce({ data: { data: metrics } });

    const result = await getPerformanceMetrics();
    expect(result.totalRequests).toBe(1000);
  });

  it('handles non-wrapped response', async () => {
    const metrics = { endpoints: {}, totalRequests: 500, errorCounts: {}, slowRequestsCount: 2 };
    mockApi.get.mockResolvedValueOnce({ data: metrics });

    const result = await getPerformanceMetrics();
    expect(result.totalRequests).toBe(500);
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Forbidden'));

    await expect(getPerformanceMetrics()).rejects.toThrow();
  });
});

describe('getAdminStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns admin stats on success', async () => {
    const stats = {
      users: { total: 100, active7d: 50, new30d: 10, premium: 25 },
      moods: { total: 500, today: 20, averageScore: 7.2 },
      content: { memories: 200, journals: 150, chatSessions: 80 },
      engagement: { activeRate: 0.5, premiumRate: 0.25 },
      generatedAt: '2024-01-01T00:00:00Z',
    };
    mockApi.get.mockResolvedValueOnce({ data: { data: stats } });

    const result = await getAdminStats();
    expect(result.users.total).toBe(100);
    expect(result.moods.averageScore).toBe(7.2);
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Unauthorized'));

    await expect(getAdminStats()).rejects.toThrow();
  });
});

describe('getAdminUsers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns users list on success', async () => {
    const usersResponse = {
      users: [{ id: 'u1', email: 'admin@test.com', displayName: 'Admin', status: 'active', role: 'admin', xp: 100, streak: 7, premium: true, createdAt: null, lastActive: null }],
      total: 1,
      page: 1,
      limit: 20,
      pages: 1,
    };
    mockApi.get.mockResolvedValueOnce({ data: { data: usersResponse } });

    const result = await getAdminUsers();
    expect(result.users).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('passes default page=1 and limit=20', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { users: [], total: 0, page: 1, limit: 20, pages: 0 } } });

    await getAdminUsers();
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: expect.objectContaining({ page: 1, limit: 20 }) })
    );
  });

  it('includes search and status params when provided', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { users: [], total: 0, page: 1, limit: 20, pages: 0 } } });

    await getAdminUsers(1, 10, 'john', 'active');
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: expect.objectContaining({ search: 'john', status: 'active' }) })
    );
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getAdminUsers()).rejects.toThrow();
  });
});

describe('updateUserStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('puts status update and returns result', async () => {
    mockApi.put.mockResolvedValueOnce({ data: { data: { userId: 'u1', newStatus: 'suspended' } } });

    const result = await updateUserStatus('u1', 'suspended');
    expect(result.userId).toBe('u1');
    expect(result.newStatus).toBe('suspended');
  });

  it('includes userId in the URL', async () => {
    mockApi.put.mockResolvedValueOnce({ data: { data: { userId: 'abc', newStatus: 'active' } } });

    await updateUserStatus('abc', 'active');
    expect(mockApi.put).toHaveBeenCalledWith(
      expect.stringContaining('abc'),
      expect.objectContaining({ status: 'active' })
    );
  });

  it('throws on API error', async () => {
    mockApi.put.mockRejectedValueOnce(new Error('Forbidden'));

    await expect(updateUserStatus('u1', 'banned')).rejects.toThrow();
  });
});

describe('getContentReports', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns reports list on success', async () => {
    const reportsResponse = {
      reports: [{ id: 'r1', contentType: 'comment', contentId: 'c1', reason: 'spam', reportedBy: 'u2', createdAt: null, status: 'pending' }],
      total: 1,
    };
    mockApi.get.mockResolvedValueOnce({ data: { data: reportsResponse } });

    const result = await getContentReports();
    expect(result.total).toBe(1);
  });

  it('passes default status=pending', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { reports: [], total: 0 } } });

    await getContentReports();
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { status: 'pending' } })
    );
  });

  it('passes custom status', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { data: { reports: [], total: 0 } } });

    await getContentReports('resolved');
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { status: 'resolved' } })
    );
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getContentReports()).rejects.toThrow();
  });
});

describe('resolveReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts resolution action and returns result', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { reportId: 'r1', action: 'dismiss' } } });

    const result = await resolveReport('r1', 'dismiss', 'Not spam');
    expect(result.reportId).toBe('r1');
    expect(result.action).toBe('dismiss');
  });

  it('includes reportId in URL', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { data: { reportId: 'xyz', action: 'ban_user' } } });

    await resolveReport('xyz', 'ban_user');
    expect(mockApi.post).toHaveBeenCalledWith(
      expect.stringContaining('xyz'),
      expect.objectContaining({ action: 'ban_user' })
    );
  });

  it('throws on API error', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('Error'));

    await expect(resolveReport('r1', 'dismiss')).rejects.toThrow();
  });
});

describe('getSystemHealth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns system health data on success', async () => {
    const health = {
      status: 'healthy' as const,
      firebase: 'connected' as const,
      timestamp: '2024-01-01T00:00:00Z',
      uptimeRequests: 10000,
      errorRate: 0.01,
    };
    mockApi.get.mockResolvedValueOnce({ data: { data: health } });

    const result = await getSystemHealth();
    expect(result.status).toBe('healthy');
    expect(result.firebase).toBe('connected');
  });

  it('throws on API error', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Error'));

    await expect(getSystemHealth()).rejects.toThrow();
  });
});
