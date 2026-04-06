/**
 * Tests for health API functions.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../client', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('../constants', () => ({
  API_ENDPOINTS: {
    HEALTH: {
      CHECK: '/api/v1/health',
      READY: '/api/v1/health/ready',
      LIVE: '/api/v1/health/live',
      METRICS: '/api/v1/health/metrics',
      DATABASE: '/api/v1/health/database',
      ADVANCED: '/api/v1/health/advanced',
    },
  },
}));

import { api } from '../client';
import {
  getHealthCheck,
  getReadiness,
  getLiveness,
  getSystemMetrics,
  getDatabaseHealth,
  isApiHealthy,
  isApiReady,
  getAdvancedHealthReport,
  getHealthStatusColor,
  getHealthStatusBadge,
  formatUptime,
  formatBytes,
  getMetricStatus,
  calculateHealthScore,
  getCriticalIssues,
  getHighPriorityRecommendations,
  exportHealthReportAsText,
  downloadHealthReport,
} from '../health';

const mockApi = api as { get: ReturnType<typeof vi.fn> };

// ===================== Pure sync functions =====================

describe('getHealthStatusColor', () => {
  it('returns green class for healthy', () => {
    expect(getHealthStatusColor('healthy')).toContain('green');
  });

  it('returns yellow/orange class for degraded', () => {
    const color = getHealthStatusColor('degraded');
    expect(color).toMatch(/yellow|orange/);
  });

  it('returns red class for unhealthy', () => {
    expect(getHealthStatusColor('unhealthy')).toContain('red');
  });

  it('returns a string for unknown status', () => {
    expect(typeof getHealthStatusColor('unknown')).toBe('string');
  });
});

describe('getHealthStatusBadge', () => {
  it('returns badge text for healthy', () => {
    expect(typeof getHealthStatusBadge('healthy')).toBe('string');
    expect(getHealthStatusBadge('healthy').length).toBeGreaterThan(0);
  });

  it('returns badge text for degraded', () => {
    expect(typeof getHealthStatusBadge('degraded')).toBe('string');
  });

  it('returns badge text for unhealthy', () => {
    expect(typeof getHealthStatusBadge('unhealthy')).toBe('string');
  });

  it('returns a string for unknown status', () => {
    expect(typeof getHealthStatusBadge('somethingunknown')).toBe('string');
  });
});

describe('formatUptime', () => {
  it('returns minutes for seconds < 3600', () => {
    expect(formatUptime(150)).toBe('2m');
  });

  it('returns hours and minutes when >= 3600', () => {
    expect(formatUptime(3661)).toBe('1h 1m');
  });

  it('returns days hours minutes when >= 86400', () => {
    expect(formatUptime(86400 * 2 + 3600 + 60)).toBe('2d 1h 1m');
  });

  it('returns 0m for 0 seconds', () => {
    expect(formatUptime(0)).toBe('0m');
  });

  it('returns 59m for 3599 seconds', () => {
    expect(formatUptime(3599)).toBe('59m');
  });
});

describe('formatBytes', () => {
  it('returns 0 B for 0', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toMatch(/B/);
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toMatch(/KB/);
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toMatch(/MB/);
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1024 ** 3)).toMatch(/GB/);
  });

  it('formats terabytes', () => {
    expect(formatBytes(1024 ** 4)).toMatch(/TB/);
  });
});

describe('getMetricStatus', () => {
  it('returns normal for low percentage', () => {
    const result = getMetricStatus(50);
    expect(result.status).toBe('normal');
    expect(result.color).toContain('green');
  });

  it('returns warning for percentage >= 80 (default threshold)', () => {
    const result = getMetricStatus(85);
    expect(result.status).toBe('warning');
    expect(result.color).toContain('yellow');
  });

  it('returns critical for percentage >= 90 (default threshold)', () => {
    const result = getMetricStatus(95);
    expect(result.status).toBe('critical');
    expect(result.color).toContain('red');
  });

  it('respects custom warning threshold', () => {
    const result = getMetricStatus(60, 50, 80);
    expect(result.status).toBe('warning');
  });

  it('respects custom critical threshold', () => {
    const result = getMetricStatus(90, 50, 85);
    expect(result.status).toBe('critical');
  });

  it('returns normal when exactly at warning threshold minus 1', () => {
    const result = getMetricStatus(79);
    expect(result.status).toBe('normal');
  });
});

const makeAdvancedReport = (overrides: Partial<Parameters<typeof calculateHealthScore>[0]> = {}): Parameters<typeof calculateHealthScore>[0] => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  response_time: 0.123,
  checks: {},
  summary: {
    total_checks: 10,
    passed_checks: 9,
    failed_checks: 1,
    critical_failures: [],
  },
  system_info: {
    cpu_count: 4,
    cpu_percent: 25.0,
    memory_total: 8 * 1024 ** 3,
    memory_available: 4 * 1024 ** 3,
    memory_percent: 50.0,
    disk_total: 100 * 1024 ** 3,
    disk_free: 50 * 1024 ** 3,
    disk_percent: 50.0,
    uptime: 86400,
  },
  recommendations: ['Increase memory', 'Optimize queries', 'Add caching'],
  ...overrides,
});

describe('calculateHealthScore', () => {
  it('returns 0 for no summary', () => {
    const report = makeAdvancedReport();
    // @ts-expect-error testing edge case
    report.summary = null;
    expect(calculateHealthScore(report)).toBe(0);
  });

  it('returns 0 when total_checks is 0', () => {
    const report = makeAdvancedReport({ summary: { total_checks: 0, passed_checks: 0, failed_checks: 0, critical_failures: [] } });
    expect(calculateHealthScore(report)).toBe(0);
  });

  it('returns 90 for 9/10 with no critical failures', () => {
    const report = makeAdvancedReport();
    expect(calculateHealthScore(report)).toBe(90);
  });

  it('applies penalty for critical failures', () => {
    const report = makeAdvancedReport({
      summary: { total_checks: 10, passed_checks: 9, failed_checks: 1, critical_failures: ['db down'] },
    });
    expect(calculateHealthScore(report)).toBe(70); // 90 - 20
  });

  it('clamps to 0 minimum', () => {
    const report = makeAdvancedReport({
      summary: { total_checks: 10, passed_checks: 0, failed_checks: 10, critical_failures: ['a', 'b', 'c', 'd', 'e', 'f'] },
    });
    expect(calculateHealthScore(report)).toBe(0);
  });
});

describe('getCriticalIssues', () => {
  it('returns critical_failures array', () => {
    const report = makeAdvancedReport({ summary: { total_checks: 5, passed_checks: 4, failed_checks: 1, critical_failures: ['db', 'cache'] } });
    expect(getCriticalIssues(report)).toEqual(['db', 'cache']);
  });

  it('returns empty array when no failures', () => {
    const report = makeAdvancedReport();
    expect(getCriticalIssues(report)).toEqual([]);
  });

  it('returns empty array when summary is missing', () => {
    const report = makeAdvancedReport();
    // @ts-expect-error testing edge case
    report.summary = undefined;
    expect(getCriticalIssues(report)).toEqual([]);
  });
});

describe('getHighPriorityRecommendations', () => {
  it('returns first 3 recommendations', () => {
    const report = makeAdvancedReport();
    const result = getHighPriorityRecommendations(report);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('Increase memory');
  });

  it('returns all when fewer than 3', () => {
    const report = makeAdvancedReport({ recommendations: ['Only one'] });
    expect(getHighPriorityRecommendations(report)).toEqual(['Only one']);
  });

  it('returns empty array when no recommendations', () => {
    const report = makeAdvancedReport({ recommendations: undefined });
    expect(getHighPriorityRecommendations(report)).toEqual([]);
  });
});

describe('exportHealthReportAsText', () => {
  it('returns a non-empty string', () => {
    const report = makeAdvancedReport();
    const text = exportHealthReportAsText(report);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('includes status in output', () => {
    const report = makeAdvancedReport({ status: 'healthy' });
    const text = exportHealthReportAsText(report);
    expect(text.toUpperCase()).toContain('HEALTHY');
  });

  it('includes SYSTEMINFO section', () => {
    const report = makeAdvancedReport();
    const text = exportHealthReportAsText(report);
    expect(text).toContain('SYSTEMINFO');
  });

  it('includes recommendations when present', () => {
    const report = makeAdvancedReport();
    const text = exportHealthReportAsText(report);
    expect(text).toContain('Increase memory');
  });
});

// ===================== Async functions =====================

describe('getHealthCheck', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns health check response', async () => {
    const data = { status: 'healthy', timestamp: '2024-01-01T00:00:00Z', service: 'api' };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    const result = await getHealthCheck();
    expect(result.status).toBe('healthy');
  });

  it('falls back to response.data when no wrapper', async () => {
    const data = { status: 'healthy', timestamp: '2024-01-01T00:00:00Z', service: 'api' };
    mockApi.get.mockResolvedValueOnce({ data });

    const result = await getHealthCheck();
    expect(result.status).toBe('healthy');
  });

  it('throws when api.get fails', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Network error'));
    await expect(getHealthCheck()).rejects.toThrow();
  });
});

describe('getReadiness', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns readiness response', async () => {
    const data = { status: 'ready', checks: { server: true, firebase: true, timestamp: '2024-01-01' } };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    const result = await getReadiness();
    expect(result.status).toBe('ready');
  });
});

describe('getLiveness', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns liveness response', async () => {
    const data = { status: 'alive', pid: 1234, timestamp: '2024-01-01T00:00:00Z' };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    const result = await getLiveness();
    expect(result.pid).toBe(1234);
  });
});

describe('getSystemMetrics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes snake_case to camelCase', async () => {
    const mockMetrics = {
      timestamp: '2024-01-01',
      system: {
        cpu_percent: 25.0,
        cpu_count: 4,
        memory_percent: 60.0,
        disk_percent: 40.0,
      },
      process: {
        pid: 123,
        memory_rss_mb: 100,
        memory_vms_mb: 200,
        cpu_percent: 5.0,
        num_threads: 8,
        open_files: 20,
      },
      app: { name: 'api', version: '1.0.0', environment: 'production' },
    };
    mockApi.get.mockResolvedValueOnce({ data: { data: mockMetrics } });

    const result = await getSystemMetrics();
    expect(result.system.cpuPercent).toBe(25.0);
    expect(result.system.cpuCount).toBe(4);
    expect(result.process.memoryRssMb).toBe(100);
    expect(result.process.numThreads).toBe(8);
  });

  it('uses camelCase values when present', async () => {
    const mockMetrics = {
      timestamp: '2024-01-01',
      system: { cpuPercent: 30, cpuCount: 8, memoryPercent: 70, diskPercent: 50 },
      process: { pid: 456, memoryRssMb: 150, memoryVmsMb: 300, cpuPercent: 3, numThreads: 4, openFiles: 10 },
      app: { name: 'api', version: '2.0.0', environment: 'test' },
    };
    mockApi.get.mockResolvedValueOnce({ data: { data: mockMetrics } });

    const result = await getSystemMetrics();
    expect(result.system.cpuPercent).toBe(30);
  });
});

describe('getDatabaseHealth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes latency_ms to latencyMs', async () => {
    const data = { status: 'healthy', database: 'firestore', latency_ms: 42, timestamp: '2024-01-01' };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    const result = await getDatabaseHealth();
    expect(result.latencyMs).toBe(42);
    expect(result.status).toBe('healthy');
  });

  it('keeps latencyMs when already camelCase', async () => {
    const data = { status: 'healthy', database: 'firestore', latencyMs: 20, timestamp: '2024-01-01' };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    const result = await getDatabaseHealth();
    expect(result.latencyMs).toBe(20);
  });
});

describe('isApiHealthy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when status is healthy', async () => {
    const data = { status: 'healthy', timestamp: '', service: 'api' };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    expect(await isApiHealthy()).toBe(true);
  });

  it('returns false when status is unhealthy', async () => {
    const data = { status: 'unhealthy', timestamp: '', service: 'api' };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    expect(await isApiHealthy()).toBe(false);
  });

  it('returns false when getHealthCheck throws', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Down'));

    expect(await isApiHealthy()).toBe(false);
  });
});

describe('isApiReady', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when status is ready', async () => {
    const data = { status: 'ready', checks: { server: true, firebase: true, timestamp: '' } };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    expect(await isApiReady()).toBe(true);
  });

  it('returns false when status is notReady', async () => {
    const data = { status: 'notReady', checks: { server: false, firebase: false, timestamp: '' } };
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    expect(await isApiReady()).toBe(false);
  });

  it('returns false when getReadiness throws', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Not available'));

    expect(await isApiReady()).toBe(false);
  });
});

describe('getAdvancedHealthReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns advanced report', async () => {
    const data = makeAdvancedReport();
    mockApi.get.mockResolvedValueOnce({ data: { data } });

    const result = await getAdvancedHealthReport();
    expect(result.status).toBe('healthy');
  });
});

describe('downloadHealthReport', () => {
  it('triggers blob download via anchor click', () => {
    const createObjectURL = vi.fn(() => 'blob:url');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const click = vi.fn();
    const mockAnchor = { href: '', download: '', click, style: {} } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValueOnce(mockAnchor);
    vi.spyOn(document.body, 'appendChild').mockImplementationOnce(() => mockAnchor);
    vi.spyOn(document.body, 'removeChild').mockImplementationOnce(() => mockAnchor);

    const report = makeAdvancedReport();
    downloadHealthReport(report);

    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:url');
  });
});
