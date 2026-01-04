/**
 * Health & Monitoring API functions
 * For admin dashboards and system monitoring
 */

import { api } from './client';
import { API_ENDPOINTS } from './constants';

// ============================================================================
// Types
// ============================================================================

/**
 * APIResponse wrapper from backend
 */
interface APIResponseWrapper<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** Basic health check response */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  service: string;
}

/** Readiness check response (camelCase from backend) */
export interface ReadinessResponse {
  status: 'ready' | 'notReady';
  checks: {
    server: boolean;
    firebase: boolean;
    firebaseError?: string;
    timestamp: string;
    // Legacy snake_case aliases
    firebase_error?: string;
  };
  // Legacy snake_case alias
  not_ready?: string;
}

/** Liveness check response */
export interface LivenessResponse {
  status: 'alive';
  pid: number;
  timestamp: string;
}

/** System metrics (admin only) - camelCase from backend */
export interface SystemMetrics {
  timestamp: string;
  system: {
    cpuPercent: number;
    cpuCount: number;
    memoryPercent: number;
    diskPercent: number;
    // Legacy snake_case aliases
    cpu_percent?: number;
    cpu_count?: number;
    memory_percent?: number;
    disk_percent?: number;
  };
  process: {
    pid: number;
    memoryRssMb: number;
    memoryVmsMb: number;
    cpuPercent: number;
    numThreads: number;
    openFiles: number;
    // Legacy snake_case aliases
    memory_rss_mb?: number;
    memory_vms_mb?: number;
    cpu_percent?: number;
    num_threads?: number;
    open_files?: number;
  };
  app: {
    name: string;
    version: string;
    environment: string;
  };
  // NEW: Application metrics from monitoring service
  application?: {
    activeUsers: number;
    totalRequests: number;
    errorRate: number;
    avgResponseTime: number;
    databaseConnections: number;
    cacheHitRate: number;
  };
}

/** Database health response (camelCase from backend) */
export interface DatabaseHealthResponse {
  status: 'healthy' | 'unhealthy';
  database: string;
  latencyMs?: number;
  error?: string;
  timestamp: string;
  // Legacy snake_case alias
  latency_ms?: number;
}

/** Health check result for individual check */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  response_time: number;
  timestamp: string;
  details?: Record<string, any>;
  error?: string;
}

/** Advanced health report with comprehensive system analysis */
export interface AdvancedHealthReport {
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  timestamp: string;
  response_time: number;
  checks: Record<string, HealthCheckResult>;
  summary: {
    total_checks: number;
    passed_checks: number;
    failed_checks: number;
    critical_failures: string[];
  };
  system_info: {
    cpu_count: number;
    cpu_percent: number;
    memory_total: number;
    memory_available: number;
    memory_percent: number;
    disk_total: number;
    disk_free: number;
    disk_percent: number;
    uptime: number;
  };
  trends?: {
    overall_trend: 'stable' | 'improving' | 'degrading';
    improving_checks: string[];
    degrading_checks: string[];
    period: string;
  };
  recommendations?: string[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Basic health check - public endpoint
 * Used to verify server is running
 */
export async function getHealthCheck(): Promise<HealthCheckResponse> {
  const response = await api.get<APIResponseWrapper<HealthCheckResponse>>(API_ENDPOINTS.HEALTH.CHECK);
  // Handle APIResponse wrapper: { success: true, data: {...}, message: "..." }
  const responseData = response.data?.data || response.data;
  return responseData as HealthCheckResponse;
}

/**
 * Readiness check - public endpoint
 * Used by load balancers/Kubernetes to verify all dependencies are ready
 */
export async function getReadiness(): Promise<ReadinessResponse> {
  const response = await api.get<APIResponseWrapper<ReadinessResponse>>(API_ENDPOINTS.HEALTH.READY);
  // Handle APIResponse wrapper
  const responseData = response.data?.data || response.data;
  return responseData as ReadinessResponse;
}

/**
 * Liveness check - public endpoint
 * Used by load balancers/Kubernetes to verify server is alive
 */
export async function getLiveness(): Promise<LivenessResponse> {
  const response = await api.get<APIResponseWrapper<LivenessResponse>>(API_ENDPOINTS.HEALTH.LIVE);
  // Handle APIResponse wrapper
  const responseData = response.data?.data || response.data;
  return responseData as LivenessResponse;
}

/**
 * System metrics - admin only
 * Returns CPU, memory, and process information
 * @requires Admin authentication
 */
export async function getSystemMetrics(): Promise<SystemMetrics> {
  const response = await api.get<APIResponseWrapper<SystemMetrics>>(API_ENDPOINTS.HEALTH.METRICS);
  // Handle APIResponse wrapper
  const responseData = response.data?.data || response.data;
  const metrics = responseData as SystemMetrics;
  
  // Normalize to camelCase
  return {
    timestamp: metrics.timestamp,
    system: {
      cpuPercent: metrics.system.cpuPercent ?? metrics.system.cpu_percent ?? 0,
      cpuCount: metrics.system.cpuCount ?? metrics.system.cpu_count ?? 0,
      memoryPercent: metrics.system.memoryPercent ?? metrics.system.memory_percent ?? 0,
      diskPercent: metrics.system.diskPercent ?? metrics.system.disk_percent ?? 0
    },
    process: {
      pid: metrics.process.pid,
      memoryRssMb: metrics.process.memoryRssMb ?? metrics.process.memory_rss_mb ?? 0,
      memoryVmsMb: metrics.process.memoryVmsMb ?? metrics.process.memory_vms_mb ?? 0,
      cpuPercent: metrics.process.cpuPercent ?? metrics.process.cpu_percent ?? 0,
      numThreads: metrics.process.numThreads ?? metrics.process.num_threads ?? 0,
      openFiles: metrics.process.openFiles ?? metrics.process.open_files ?? 0
    },
    app: metrics.app
  };
}

/**
 * Database health check - requires authentication
 * Tests Firestore connectivity and returns latency
 */
export async function getDatabaseHealth(): Promise<DatabaseHealthResponse> {
  const response = await api.get<APIResponseWrapper<DatabaseHealthResponse>>(API_ENDPOINTS.HEALTH.DATABASE);
  // Handle APIResponse wrapper
  const responseData = response.data?.data || response.data;
  const health = responseData as DatabaseHealthResponse;
  
  // Normalize to camelCase
  return {
    status: health.status,
    database: health.database,
    latencyMs: health.latencyMs ?? health.latency_ms,
    error: health.error,
    timestamp: health.timestamp
  };
}

/**
 * Check if API is available (quick ping)
 * Returns true if healthy, false otherwise
 */
export async function isApiHealthy(): Promise<boolean> {
  try {
    const response = await getHealthCheck();
    return response.status === 'healthy';
  } catch {
    return false;
  }
}

/**
 * Check if API is ready to handle requests
 * Returns true if all dependencies are ready
 */
export async function isApiReady(): Promise<boolean> {
  try {
    const response = await getReadiness();
    return response.status === 'ready';
  } catch {
    return false;
  }
}

/**
 * Advanced health check - admin only
 * Returns comprehensive system analysis with trends and recommendations
 * @requires Admin authentication
 */
export async function getAdvancedHealthReport(): Promise<AdvancedHealthReport> {
  const response = await api.get<APIResponseWrapper<AdvancedHealthReport>>(API_ENDPOINTS.HEALTH.ADVANCED);
  // Handle APIResponse wrapper
  const responseData = response.data?.data || response.data;
  return responseData as AdvancedHealthReport;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get status color for UI display
 */
export function getHealthStatusColor(status: string): string {
  const colors: Record<string, string> = {
    healthy: 'text-green-600 dark:text-green-400',
    ready: 'text-green-600 dark:text-green-400',
    alive: 'text-green-600 dark:text-green-400',
    degraded: 'text-yellow-600 dark:text-yellow-400',
    critical: 'text-red-600 dark:text-red-400',
    unhealthy: 'text-red-600 dark:text-red-400',
    notReady: 'text-red-600 dark:text-red-400',
    unknown: 'text-gray-600 dark:text-gray-400'
  };
  return (colors[status] ?? colors.unknown) as string;
}

/**
 * Get status badge color for UI
 */
export function getHealthStatusBadge(status: string): string {
  const badges: Record<string, string> = {
    healthy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    alive: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    degraded: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    unhealthy: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    notReady: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  };
  return (badges[status] ?? badges.unknown) as string;
}

/**
 * Format uptime for display (seconds to human readable)
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Get metric status based on percentage thresholds
 */
export function getMetricStatus(
  percent: number,
  warningThreshold: number = 80,
  criticalThreshold: number = 90
): {
  status: 'normal' | 'warning' | 'critical';
  color: string;
} {
  if (percent >= criticalThreshold) {
    return { status: 'critical', color: 'text-red-600 dark:text-red-400' };
  } else if (percent >= warningThreshold) {
    return { status: 'warning', color: 'text-yellow-600 dark:text-yellow-400' };
  } else {
    return { status: 'normal', color: 'text-green-600 dark:text-green-400' };
  }
}

/**
 * Calculate overall health score (0-100)
 */
export function calculateHealthScore(report: AdvancedHealthReport): number {
  if (!report.summary) return 0;
  
  const { total_checks, passed_checks, critical_failures } = report.summary;
  
  if (total_checks === 0) return 0;
  
  // Base score from passed checks
  let score = (passed_checks / total_checks) * 100;
  
  // Penalty for critical failures
  score -= critical_failures.length * 20;
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get critical issues from report
 */
export function getCriticalIssues(report: AdvancedHealthReport): string[] {
  return report.summary?.critical_failures || [];
}

/**
 * Get high priority recommendations (top 3)
 */
export function getHighPriorityRecommendations(report: AdvancedHealthReport): string[] {
  return report.recommendations?.slice(0, 3) || [];
}

/**
 * Export health report as text file
 */
export function exportHealthReportAsText(report: AdvancedHealthReport): string {
  let text = `SYSTEM HEALTH REPORT\n`;
  text += `Genererad: ${new Date(report.timestamp).toLocaleString('sv-SE')}\n\n`;
  
  text += `ÖVERGRIPANDE STATUS: ${report.status.toUpperCase()}\n`;
  text += `Health Score: ${calculateHealthScore(report)}/100\n`;
  text += `Response Time: ${report.response_time.toFixed(3)}s\n\n`;
  
  text += `SAMMANFATTNING:\n`;
  text += `- Totala kontroller: ${report.summary.total_checks}\n`;
  text += `- Godkända: ${report.summary.passed_checks}\n`;
  text += `- Misslyckade: ${report.summary.failed_checks}\n`;
  text += `- Kritiska fel: ${report.summary.critical_failures.length}\n\n`;
  
  if (report.summary.critical_failures.length > 0) {
    text += `KRITISKA FEL:\n`;
    report.summary.critical_failures.forEach(failure => {
      text += `- ${failure}\n`;
    });
    text += `\n`;
  }
  
  if (report.recommendations && report.recommendations.length > 0) {
    text += `REKOMMENDATIONER:\n`;
    report.recommendations.forEach((rec, i) => {
      text += `${i + 1}. ${rec}\n`;
    });
    text += `\n`;
  }
  
  text += `SYSTEMINFO:\n`;
  text += `- CPU: ${report.system_info.cpu_percent.toFixed(1)}% (${report.system_info.cpu_count} kärnor)\n`;
  text += `- Minne: ${report.system_info.memory_percent.toFixed(1)}% (${formatBytes(report.system_info.memory_available)} tillgängligt)\n`;
  text += `- Disk: ${report.system_info.disk_percent.toFixed(1)}% (${formatBytes(report.system_info.disk_free)} ledigt)\n`;
  text += `- Uptime: ${formatUptime(report.system_info.uptime)}\n`;
  
  return text;
}

/**
 * Download health report as text file
 */
export function downloadHealthReport(report: AdvancedHealthReport): void {
  const text = exportHealthReportAsText(report);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `health-report-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
