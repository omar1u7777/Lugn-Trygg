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
   * Format log message with prefix and context
   */
  private formatMessage(message: string, context?: Record<string, any>): any[] {
    const parts: any[] = [];
    
    if (this.config.prefix) {
      parts.push(this.config.prefix);
    }
    
    parts.push(message);
    
    if (context && Object.keys(context).length > 0) {
      parts.push('\n Context:', context);
    }
    
    return parts;
  }

  /**
   * Development-only logging (removed in production)
   */
  log(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('log')) {
      console.log(...this.formatMessage(message, context));
    }
  }

  /**
   * Debug logging (development only)
   */
  debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      console.debug(...this.formatMessage(`[DEBUG] ${message}`, context));
    }
  }

  /**
   * Info logging (development only)
   */
  info(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      console.info(...this.formatMessage(`[INFO] ${message}`, context));
    }
  }

  /**
   * Warning (enabled in all environments)
   */
  warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage(`⚠️ ${message}`, context));
    }
  }

  /**
   * Error logging (enabled in all environments)
   */
  error(message: string, error?: Error | unknown, context?: Record<string, any>): void {
    if (this.shouldLog('error')) {
      const errorContext = error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        ...context
      } : context;
      
      console.error(...this.formatMessage(`❌ ${message}`, errorContext));
      
      // In production, you might want to send errors to a service like Sentry
      if (!this.isDev && error instanceof Error) {
        // TODO: Send to error tracking service
        // Example: Sentry.captureException(error, { extra: context });
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
  table(data: any[]): void {
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
