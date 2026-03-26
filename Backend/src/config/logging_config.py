"""
Production Logging Configuration - Structured logging for all environments

Provides comprehensive logging setup with:
- Structured JSON logging
- Log rotation and retention
- Different log levels for different components
- Performance monitoring integration
- Security event logging
"""

import json
import logging
import logging.config
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Mapping, MutableMapping, cast

# Module logger
logger = logging.getLogger(__name__)
_LOGGING_INITIALIZED = False

# Logging levels
LOG_LEVELS = {
    'DEBUG': logging.DEBUG,
    'INFO': logging.INFO,
    'WARNING': logging.WARNING,
    'ERROR': logging.ERROR,
    'CRITICAL': logging.CRITICAL
}


def _anonymize_ip(ip_address: Any) -> str:
    """Return anonymized IP for GDPR-safe logs."""
    ip_text = str(ip_address or "").strip()
    if not ip_text:
        return "unknown"

    if ":" in ip_text:
        return ip_text.split(":")[0] + "::"

    parts = ip_text.split('.')
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.x.x"

    return "masked"


def _mask_user_id(user_id: Any) -> str:
    """Mask user IDs to avoid storing direct identifiers in logs."""
    user_text = str(user_id or "").strip()
    if not user_text or user_text == "anonymous":
        return "anonymous"
    if len(user_text) <= 6:
        return "***"
    return f"{user_text[:3]}***{user_text[-3:]}"


def _build_logger_handlers(
    log_to_console: bool,
    log_to_file: bool,
    include_security_file: bool = False,
    include_performance_file: bool = False,
) -> list[str]:
    """Build valid logger handler list based on enabled outputs."""
    handlers: list[str] = []

    if log_to_console:
        handlers.append('console')

    if log_to_file:
        if include_security_file:
            handlers.append('file_security')
        elif include_performance_file:
            handlers.append('file_performance')
        else:
            handlers.append('file_app')

    return handlers

class StructuredFormatter(logging.Formatter):
    """JSON structured logging formatter"""

    def format(self, record: logging.LogRecord) -> str:
        # Create base log entry
        log_entry = {
            'timestamp': datetime.now(UTC).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }

        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)

        # Add extra fields from record
        user_id = getattr(record, 'user_id', None)
        if user_id is not None:
            log_entry['user_id'] = _mask_user_id(user_id)
        request_id = getattr(record, 'request_id', None)
        if request_id is not None:
            log_entry['request_id'] = request_id
        session_id = getattr(record, 'session_id', None)
        if session_id is not None:
            log_entry['session_id'] = session_id
        ip_address = getattr(record, 'ip_address', None)
        if ip_address is not None:
            log_entry['ip_address'] = _anonymize_ip(ip_address)
        user_agent = getattr(record, 'user_agent', None)
        if user_agent is not None:
            log_entry['user_agent'] = user_agent

        # Add any additional fields from extra parameter
        extra_fields = getattr(record, '_extra_fields', None)
        if isinstance(extra_fields, dict):
            log_entry.update(extra_fields)

        # Performance metrics
        response_time = getattr(record, 'response_time', None)
        if response_time is not None:
            log_entry['response_time'] = response_time
        db_query_time = getattr(record, 'db_query_time', None)
        if db_query_time is not None:
            log_entry['db_query_time'] = db_query_time

        return json.dumps(log_entry, ensure_ascii=False)

class SecurityFormatter(logging.Formatter):
    """Security-focused logging formatter"""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            'timestamp': datetime.now(UTC).isoformat(),
            'level': record.levelname,
            'event_type': getattr(record, 'event_type', 'unknown'),
            'message': record.getMessage(),
            'source_ip': _anonymize_ip(getattr(record, 'ip_address', 'unknown')),
            'user_id': _mask_user_id(getattr(record, 'user_id', 'anonymous')),
            'user_agent': getattr(record, 'user_agent', 'unknown'),
            'session_id': getattr(record, 'session_id', 'unknown'),
            'request_id': getattr(record, 'request_id', 'unknown'),
        }

        # Add security-specific fields
        security_event = getattr(record, 'security_event', None)
        if security_event is not None:
            log_entry['security_event'] = security_event
        attack_type = getattr(record, 'attack_type', None)
        if attack_type is not None:
            log_entry['attack_type'] = attack_type
        severity = getattr(record, 'severity', None)
        if severity is not None:
            log_entry['severity'] = severity

        return json.dumps(log_entry, ensure_ascii=False)

def setup_logging(
    log_level: str = 'INFO',
    log_to_file: bool = True,
    log_to_console: bool = True,
    log_directory: str = 'logs',
    max_file_size: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5,
    enable_security_logging: bool = True
) -> dict[str, Any]:
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
    global _LOGGING_INITIALIZED

    normalized_level = log_level.upper() if log_level.upper() in LOG_LEVELS else 'INFO'

    # Do not leave the app without any logging sink.
    if not log_to_console and not log_to_file:
        log_to_console = True

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
            'level': normalized_level,
            'handlers': []
        }
    }

    # Console handler
    if log_to_console:
        config['handlers']['console'] = {
            'class': 'logging.StreamHandler',
            'level': normalized_level,
            'formatter': 'simple' if os.getenv('FLASK_ENV') == 'development' else 'structured',
            'stream': sys.stdout
        }
        config['root']['handlers'].append('console')

    # File handlers
    if log_to_file:
        # Application logs
        config['handlers']['file_app'] = {
            'class': 'logging.handlers.RotatingFileHandler',
            'level': normalized_level,
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
            'handlers': _build_logger_handlers(
                log_to_console=log_to_console,
                log_to_file=(enable_security_logging and log_to_file),
                include_security_file=True,
            ),
            'propagate': True
        },

        # Performance monitoring
        'performance': {
            'level': 'INFO',
            'handlers': _build_logger_handlers(
                log_to_console=log_to_console,
                log_to_file=log_to_file,
                include_performance_file=True,
            ),
            'propagate': True
        },

        # Database operations
        'database': {
            'level': 'INFO',
            'handlers': _build_logger_handlers(log_to_console=log_to_console, log_to_file=log_to_file),
            'propagate': True
        },

        # External API calls
        'external_api': {
            'level': 'INFO',
            'handlers': _build_logger_handlers(log_to_console=log_to_console, log_to_file=log_to_file),
            'propagate': True
        },

        # Audit trail
        'audit': {
            'level': 'INFO',
            'handlers': _build_logger_handlers(
                log_to_console=log_to_console,
                log_to_file=(enable_security_logging and log_to_file),
                include_security_file=True,
            ),
            'propagate': True
        }
    }

    # Apply configuration
    logging.config.dictConfig(config)
    _LOGGING_INITIALIZED = True

    # Set up log level overrides from environment
    _apply_log_level_overrides()

    logger.info("Logging configuration applied", extra={
        'log_level': normalized_level,
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

    def process(self, msg: str, kwargs: MutableMapping[str, Any]):
        # Add context to extra
        incoming_extra = kwargs.get('extra', {})
        extra: dict[str, Any] = dict(incoming_extra) if isinstance(incoming_extra, Mapping) else {}

        adapter_extra = self.extra if isinstance(self.extra, Mapping) else {}
        extra.update(cast(Mapping[str, Any], adapter_extra))

        # Handle special context fields
        for key, value in extra.items():
            if hasattr(self, f'_set_{key}'):
                setattr(self, key, value)

        kwargs['extra'] = extra
        return msg, kwargs

    def log_with_context(self, level: int, msg: str, **context):
        """Log with additional context"""
        extra: dict[str, Any] = dict(self.extra) if isinstance(self.extra, Mapping) else {}
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
    global _LOGGING_INITIALIZED

    if _LOGGING_INITIALIZED:
        return

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
if os.getenv('AUTO_INIT_LOGGING', 'false').lower() == 'true' and __name__ != '__main__':
    init_logging()
