"""
Production Logging Configuration - Structured logging for all environments

Provides comprehensive logging setup with:
- Structured JSON logging
- Log rotation and retention
- Different log levels for different components
- Performance monitoring integration
- Security event logging
"""

import os
import logging
import logging.config
import json
import sys
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from pathlib import Path

# Logging levels
LOG_LEVELS = {
    'DEBUG': logging.DEBUG,
    'INFO': logging.INFO,
    'WARNING': logging.WARNING,
    'ERROR': logging.ERROR,
    'CRITICAL': logging.CRITICAL
}

class StructuredFormatter(logging.Formatter):
    """JSON structured logging formatter"""

    def format(self, record: logging.LogRecord) -> str:
        # Create base log entry
        log_entry = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }

        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)

        # Add extra fields from record
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
        if hasattr(record, 'session_id'):
            log_entry['session_id'] = record.session_id
        if hasattr(record, 'ip_address'):
            log_entry['ip_address'] = record.ip_address
        if hasattr(record, 'user_agent'):
            log_entry['user_agent'] = record.user_agent

        # Add any additional fields from extra parameter
        if hasattr(record, '_extra_fields'):
            log_entry.update(record._extra_fields)

        # Performance metrics
        if hasattr(record, 'response_time'):
            log_entry['response_time'] = record.response_time
        if hasattr(record, 'db_query_time'):
            log_entry['db_query_time'] = record.db_query_time

        return json.dumps(log_entry, ensure_ascii=False)

class SecurityFormatter(logging.Formatter):
    """Security-focused logging formatter"""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname,
            'event_type': getattr(record, 'event_type', 'unknown'),
            'message': record.getMessage(),
            'source_ip': getattr(record, 'ip_address', 'unknown'),
            'user_id': getattr(record, 'user_id', 'anonymous'),
            'user_agent': getattr(record, 'user_agent', 'unknown'),
            'session_id': getattr(record, 'session_id', 'unknown'),
            'request_id': getattr(record, 'request_id', 'unknown'),
        }

        # Add security-specific fields
        if hasattr(record, 'security_event'):
            log_entry['security_event'] = record.security_event
        if hasattr(record, 'attack_type'):
            log_entry['attack_type'] = record.attack_type
        if hasattr(record, 'severity'):
            log_entry['severity'] = record.severity

        return json.dumps(log_entry, ensure_ascii=False)

def setup_logging(
    log_level: str = 'INFO',
    log_to_file: bool = True,
    log_to_console: bool = True,
    log_directory: str = 'logs',
    max_file_size: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5,
    enable_security_logging: bool = True
) -> Dict[str, Any]:
    """
    Set up comprehensive logging configuration

    Args:
        log_level: Default log level
        log_to_file: Whether to log to files
        log_to_console: Whether to log to console
        log_directory: Directory for log files
        max_file_size: Maximum size of log files before rotation
        backup_count: Number of backup files to keep
        enable_security_logging: Whether to enable separate security logging

    Returns:
        Logging configuration dictionary
    """

    # Ensure log directory exists
    if log_to_file:
        Path(log_directory).mkdir(parents=True, exist_ok=True)

    # Base configuration
    config = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'structured': {
                '()': StructuredFormatter,
            },
            'security': {
                '()': SecurityFormatter,
            },
            'simple': {
                'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            }
        },
        'handlers': {},
        'loggers': {},
        'root': {
            'level': log_level,
            'handlers': []
        }
    }

    # Console handler
    if log_to_console:
        config['handlers']['console'] = {
            'class': 'logging.StreamHandler',
            'level': log_level,
            'formatter': 'simple' if os.getenv('FLASK_ENV') == 'development' else 'structured',
            'stream': sys.stdout
        }
        config['root']['handlers'].append('console')

    # File handlers
    if log_to_file:
        # Application logs
        config['handlers']['file_app'] = {
            'class': 'logging.handlers.RotatingFileHandler',
            'level': log_level,
            'formatter': 'structured',
            'filename': os.path.join(log_directory, 'app.log'),
            'maxBytes': max_file_size,
            'backupCount': backup_count,
            'encoding': 'utf-8'
        }

        # Error logs
        config['handlers']['file_error'] = {
            'class': 'logging.handlers.RotatingFileHandler',
            'level': 'ERROR',
            'formatter': 'structured',
            'filename': os.path.join(log_directory, 'error.log'),
            'maxBytes': max_file_size,
            'backupCount': backup_count,
            'encoding': 'utf-8'
        }

        # Performance logs
        config['handlers']['file_performance'] = {
            'class': 'logging.handlers.RotatingFileHandler',
            'level': 'INFO',
            'formatter': 'structured',
            'filename': os.path.join(log_directory, 'performance.log'),
            'maxBytes': max_file_size,
            'backupCount': backup_count,
            'encoding': 'utf-8'
        }

        config['root']['handlers'].extend(['file_app', 'file_error'])

    # Security logging
    if enable_security_logging and log_to_file:
        config['handlers']['file_security'] = {
            'class': 'logging.handlers.RotatingFileHandler',
            'level': 'INFO',
            'formatter': 'security',
            'filename': os.path.join(log_directory, 'security.log'),
            'maxBytes': max_file_size,
            'backupCount': backup_count,
            'encoding': 'utf-8'
        }

    # Logger-specific configurations
    config['loggers'] = {
        # Security events
        'security': {
            'level': 'INFO',
            'handlers': ['console', 'file_security'] if enable_security_logging and log_to_file else ['console'],
            'propagate': False
        },

        # Performance monitoring
        'performance': {
            'level': 'INFO',
            'handlers': ['console', 'file_performance'] if log_to_file else ['console'],
            'propagate': False
        },

        # Database operations
        'database': {
            'level': 'INFO',
            'handlers': ['console', 'file_app'] if log_to_file else ['console'],
            'propagate': False
        },

        # External API calls
        'external_api': {
            'level': 'INFO',
            'handlers': ['console', 'file_app'] if log_to_file else ['console'],
            'propagate': False
        },

        # Audit trail
        'audit': {
            'level': 'INFO',
            'handlers': ['console', 'file_security'] if enable_security_logging and log_to_file else ['console'],
            'propagate': False
        }
    }

    # Apply configuration
    logging.config.dictConfig(config)

    # Set up log level overrides from environment
    _apply_log_level_overrides()

    logger.info("Logging configuration applied", extra={
        'log_level': log_level,
        'log_to_file': log_to_file,
        'log_to_console': log_to_console,
        'security_logging': enable_security_logging
    })

    return config

def _apply_log_level_overrides():
    """Apply log level overrides from environment variables"""
    overrides = {
        'LOG_LEVEL_ROOT': 'root',
        'LOG_LEVEL_SECURITY': 'security',
        'LOG_LEVEL_PERFORMANCE': 'performance',
        'LOG_LEVEL_DATABASE': 'database',
        'LOG_LEVEL_EXTERNAL_API': 'external_api',
        'LOG_LEVEL_AUDIT': 'audit',
    }

    for env_var, logger_name in overrides.items():
        level_str = os.getenv(env_var)
        if level_str and level_str.upper() in LOG_LEVELS:
            level = LOG_LEVELS[level_str.upper()]
            logging.getLogger(logger_name).setLevel(level)
            logger.info(f"Applied log level override: {logger_name} = {level_str}")

def get_logger(name: str, **context) -> logging.LoggerAdapter:
    """
    Get a logger with context information

    Args:
        name: Logger name
        **context: Context information to include in all log records

    Returns:
        LoggerAdapter with context
    """
    logger = logging.getLogger(name)
    return ContextLoggerAdapter(logger, context)

class ContextLoggerAdapter(logging.LoggerAdapter):
    """Logger adapter that adds context to all log records"""

    def process(self, msg, kwargs):
        # Add context to extra
        extra = kwargs.get('extra', {})
        extra.update(self.extra)

        # Handle special context fields
        for key, value in extra.items():
            if hasattr(self, f'_set_{key}'):
                setattr(self, key, value)

        kwargs['extra'] = extra
        return msg, kwargs

    def log_with_context(self, level: int, msg: str, **context):
        """Log with additional context"""
        extra = dict(self.extra)
        extra.update(context)
        self.log(level, msg, extra=extra)

# Convenience functions for different log types
def log_security_event(event_type: str, message: str, **context):
    """Log a security event"""
    logger = get_logger('security')
    logger.info(message, extra={
        'event_type': event_type,
        'security_event': True,
        **context
    })

def log_performance_metric(metric_name: str, value: float, **context):
    """Log a performance metric"""
    logger = get_logger('performance')
    logger.info(f"Performance metric: {metric_name} = {value}", extra={
        'metric_name': metric_name,
        'metric_value': value,
        **context
    })

def log_database_operation(operation: str, duration: float, **context):
    """Log a database operation"""
    logger = get_logger('database')
    logger.info(f"DB operation: {operation}", extra={
        'db_operation': operation,
        'db_query_time': duration,
        **context
    })

def log_api_call(endpoint: str, method: str, status_code: int, duration: float, **context):
    """Log an API call"""
    logger = get_logger('external_api')
    logger.info(f"API call: {method} {endpoint} -> {status_code}", extra={
        'api_endpoint': endpoint,
        'api_method': method,
        'api_status_code': status_code,
        'response_time': duration,
        **context
    })

def log_audit_event(event_type: str, user_id: str, resource: str, action: str, **context):
    """Log an audit event"""
    logger = get_logger('audit')
    logger.info(f"Audit: {event_type} - {user_id} {action} {resource}", extra={
        'event_type': event_type,
        'user_id': user_id,
        'resource': resource,
        'action': action,
        **context
    })

# Initialize logging with defaults
def init_logging():
    """Initialize logging with environment-based configuration"""
    log_level = os.getenv('LOG_LEVEL', 'INFO')
    log_to_file = os.getenv('LOG_TO_FILE', 'true').lower() == 'true'
    log_to_console = os.getenv('LOG_TO_CONSOLE', 'true').lower() == 'true'
    log_directory = os.getenv('LOG_DIRECTORY', 'logs')
    enable_security = os.getenv('ENABLE_SECURITY_LOGGING', 'true').lower() == 'true'

    setup_logging(
        log_level=log_level,
        log_to_file=log_to_file,
        log_to_console=log_to_console,
        log_directory=log_directory,
        enable_security_logging=enable_security
    )

# Auto-initialize if this module is imported
if __name__ != '__main__':
    init_logging()