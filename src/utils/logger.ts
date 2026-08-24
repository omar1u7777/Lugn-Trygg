/**
 * Production-Safe Logger
 * 
 * ⚠️ SECURITY: Console logging in production can expose:
 * - Internal business logic
 * - User data and behaviors
 * - API endpoints and parameters
 * - Error details that help attackers
 * 
 * This logger:
 * ✅ Only logs in development environment
 * ✅ Always allows warnings and errors (needed for debugging)
 * ✅ Adds optional context tracking
 * ✅ Can be configured per-environment
 */

import { isDevEnvironment } from '../config/env';
// sentryClient is deliberately import-free, so this cannot create a cycle even
// though nearly every module in the app imports this logger.
import { captureException } from '../services/sentryClient';

/**
 * JSON.stringify that cannot throw.
 *
 * Log context routinely contains a circular reference — a React synthetic
 * event, an axios error carrying its own request — and a logger that throws
 * while reporting a failure loses the failure as well as itself.
 */
const safeStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val as object)) return '[Circular]';
        seen.add(val as object);
      }
      if (typeof val === 'bigint') return val.toString();
      if (typeof val === 'function') return '[Function]';
      return val;
    }) ?? String(value);
  } catch {
    return '[Unserializable context]';
  }
};

type LogLevel = 'log' | 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enableInProduction: LogLevel[];
  prefix?: string;
}

const DEFAULT_CONFIG: LoggerConfig = {
  // In production, only allow warnings and errors
  enableInProduction: ['warn', 'error'],
  prefix: '[Lugn-Trygg]',
};

class Logger {
  private config: LoggerConfig;
  private isDev: boolean;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.isDev = isDevEnvironment();
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    if (this.isDev) {
      return true; // Always log in development
    }
    return this.config.enableInProduction.includes(level);
  }

  /**
   * Normalize arbitrary context values into a serializable object payload.
   */
  private normalizeContext(context?: unknown): Record<string, unknown> | undefined {
    if (context === undefined || context === null) {
      return undefined;
    }

    if (Array.isArray(context)) {
      return { items: context };
    }

    if (context instanceof Error) {
      return {
        message: context.message,
        stack: context.stack,
      };
    }

    if (typeof context === 'object') {
      return context as Record<string, unknown>;
    }

    return { value: context };
  }

  /**
   * Format log message with prefix and context
   */
  private formatMessage(message: string, context?: unknown): unknown[] {
    const parts: unknown[] = [];
    const normalizedContext = this.normalizeContext(context);
    
    if (this.config.prefix) {
      parts.push(this.config.prefix);
    }
    
    parts.push(message);
    
    if (normalizedContext && Object.keys(normalizedContext).length > 0) {
      /*
       * Serialised outside development.
       *
       * console.log(obj) renders as an expandable object in devtools, which is
       * exactly what you want while debugging locally. But the moment the
       * console is read as text — the only way anyone reads it in production —
       * it collapses to the literal string "Context: Object". A log line that
       * names its context and then withholds it is worse than one that never
       * had any.
       */
      if (isDevEnvironment()) {
        parts.push('\n Context:', normalizedContext);
      } else {
        parts.push('\n Context:', safeStringify(normalizedContext));
      }
    }
    
    return parts;
  }

  /**
   * Development-only logging (removed in production)
   */
  log(message: string, context?: unknown): void {
    if (this.shouldLog('log')) {
      console.log(...this.formatMessage(message, context));
    }
  }

  /**
   * Debug logging (development only)
   */
  debug(message: string, context?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(...this.formatMessage(`[DEBUG] ${message}`, context));
    }
  }

  /**
   * Info logging (development only)
   */
  info(message: string, context?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(...this.formatMessage(`[INFO] ${message}`, context));
    }
  }

  /**
   * Warning (enabled in all environments)
   */
  warn(message: string, context?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage(`⚠️ ${message}`, context));
    }
  }

  /**
   * Error logging (enabled in all environments)
   */
  error(message: string, error?: Error | unknown, context?: unknown): void {
    if (this.shouldLog('error')) {
      const errorContext = error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        ...this.normalizeContext(context)
      } : this.normalizeContext(context ?? error);
      
      console.error(...this.formatMessage(`❌ ${message}`, errorContext));
      
      // Forward runtime errors to Sentry. This used to be gated on
      // `window.Sentry`, a global nothing in this codebase assigns, so no
      // logger.error() has ever reached Sentry. Reporting now goes through
      // the shared client, which queues calls raised before the SDK loads.
      if (!this.isDev && error instanceof Error) {
        captureException(error, {
          tags: { source: 'logger' },
          extra: {
            loggerMessage: message,
            ...this.normalizeContext(context),
          },
        });
      }
    }
  }

  /**
   * Performance timing
   */
  time(label: string): void {
    if (this.shouldLog('debug')) {
      console.time(this.config.prefix ? `${this.config.prefix} ${label}` : label);
    }
  }

  /**
   * End performance timing
   */
  timeEnd(label: string): void {
    if (this.shouldLog('debug')) {
      console.timeEnd(this.config.prefix ? `${this.config.prefix} ${label}` : label);
    }
  }

  /**
   * Table logging (development only)
   */
  table(data: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.table(data);
    }
  }

  /**
   * Group logging (development only)
   */
  group(label: string): void {
    if (this.shouldLog('debug')) {
      console.group(this.config.prefix ? `${this.config.prefix} ${label}` : label);
    }
  }

  /**
   * End group logging
   */
  groupEnd(): void {
    if (this.shouldLog('debug')) {
      console.groupEnd();
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export Logger class for custom instances
export { Logger };

// Export convenience functions
export const log = logger.log.bind(logger);
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);

// Default export
export default logger;
