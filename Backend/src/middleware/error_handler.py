"""
Production Error Handler - Comprehensive error handling and recovery

Provides centralized error handling, graceful degradation, circuit breakers,
and automatic recovery mechanisms for production environments.
"""

import logging
import threading
import time
import traceback
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from functools import wraps
from typing import Any

logger = logging.getLogger(__name__)

class CircuitBreaker:
    """Circuit breaker for external service calls"""

    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60,
                 expected_exception: type[Exception] = Exception):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception

        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN

        self._lock = threading.Lock()

    def call(self, func: Callable, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        if self.state == 'OPEN':
            if self._should_attempt_reset():
                self.state = 'HALF_OPEN'
                logger.info("Circuit breaker entering HALF_OPEN state")
            else:
                raise CircuitBreakerOpenException("Circuit breaker is OPEN")

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception as e:
            self._on_failure()
            raise e

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self.last_failure_time is None:
            return True

        elapsed = time.time() - self.last_failure_time
        return elapsed >= self.recovery_timeout

    def _on_success(self):
        """Handle successful call"""
        with self._lock:
            if self.state == 'HALF_OPEN':
                self.state = 'CLOSED'
                self.failure_count = 0
                logger.info("Circuit breaker reset to CLOSED state")

    def _on_failure(self):
        """Handle failed call"""
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()

            if self.failure_count >= self.failure_threshold:
                self.state = 'OPEN'
                logger.warning(f"Circuit breaker opened after {self.failure_count} failures")

class CircuitBreakerOpenException(Exception):
    """Exception raised when circuit breaker is open"""
    pass

class ErrorHandler:
    """Centralized error handling and recovery system"""

    def __init__(self):
        self.error_counts: dict[str, int] = {}
        self.error_history: list[dict[str, Any]] = []
        self.circuit_breakers: dict[str, CircuitBreaker] = {}
        self.recovery_actions: dict[str, Callable] = {}

        # Error thresholds for alerts
        self.error_thresholds = {
            'rate_limit': 10,  # Errors per minute
            'database': 5,
            'external_api': 3,
            'authentication': 5,
        }

        # Start background monitoring
        self._monitoring_thread = threading.Thread(target=self._monitor_errors, daemon=True)
        self._monitoring_thread.start()

    def register_circuit_breaker(self, name: str, circuit_breaker: CircuitBreaker):
        """Register a circuit breaker"""
        self.circuit_breakers[name] = circuit_breaker
        logger.info(f"Registered circuit breaker: {name}")

    def register_recovery_action(self, error_type: str, action: Callable):
        """Register a recovery action for specific error types"""
        self.recovery_actions[error_type] = action
        logger.info(f"Registered recovery action for: {error_type}")

    def handle_error(self, error: Exception, context: dict[str, Any] | None = None,
                    should_retry: bool = False, max_retries: int = 3,
                    retry_callable: Callable | None = None) -> dict[str, Any]:
        """
        Handle an error with comprehensive logging and recovery

        Args:
            error: The exception that occurred
            context: Additional context information
            should_retry: Whether to attempt retry
            max_retries: Maximum number of retry attempts
            retry_callable: The operation to retry (required if should_retry=True)

        Returns:
            Error handling result
        """
        error_type = type(error).__name__
        error_message = str(error)
        timestamp = datetime.now(UTC)

        # Create error record
        error_record = {
            'timestamp': timestamp,
            'error_type': error_type,
            'error_message': error_message,
            'context': context or {},
            'traceback': traceback.format_exc(),
            'handled': False,
            'retried': False,
            'recovered': False
        }

        # Update error counts
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1

        # Add to history
        self.error_history.append(error_record)

        # Keep only recent errors (last 1000)
        if len(self.error_history) > 1000:
            self.error_history = self.error_history[-1000:]

        # Log error with appropriate level
        self._log_error(error_record)

        # Attempt recovery
        recovery_result = self._attempt_recovery(error_record)

        if recovery_result['recovered']:
            error_record['recovered'] = True
            error_record['recovery_action'] = recovery_result['action']
        else:
            # Check if retry is appropriate
            if should_retry and max_retries > 0 and retry_callable is not None:
                retry_result = self._attempt_retry(retry_callable, context, max_retries)
                if retry_result['success']:
                    error_record['retried'] = True
                    error_record['retry_attempt'] = retry_result['attempt']
                    return {
                        'handled': True,
                        'recovered': True,
                        'retry_success': True,
                        'result': retry_result['result']
                    }

        error_record['handled'] = True

        return {
            'handled': True,
            'recovered': recovery_result['recovered'],
            'error_record': error_record,
            'should_alert': self._should_alert(error_record)
        }

    def _log_error(self, error_record: dict[str, Any]):
        """Log error with appropriate severity"""
        error_type = error_record['error_type']
        context = error_record['context']

        # Determine log level based on error type and frequency
        error_count = self.error_counts.get(error_type, 0)

        if error_count > 100:  # Very frequent errors
            log_level = logging.ERROR
            message = f"Frequent error ({error_count} times): {error_type}"
        elif error_type in ['DatabaseError', 'ConnectionError']:
            log_level = logging.WARNING
            message = f"Service error: {error_type}"
        elif error_type in ['ValueError', 'TypeError']:
            log_level = logging.INFO
            message = f"Input validation error: {error_type}"
        else:
            log_level = logging.ERROR
            message = f"Unexpected error: {error_type}"

        # Add context information
        if context:
            message += f" - Context: {context}"

        logger.log(log_level, message, exc_info=True)

    def _attempt_recovery(self, error_record: dict[str, Any]) -> dict[str, Any]:
        """Attempt to recover from error"""
        error_type = error_record['error_type']

        # Check if we have a recovery action for this error type
        if error_type in self.recovery_actions:
            try:
                action = self.recovery_actions[error_type]
                action(error_record)

                logger.info(f"Recovery action succeeded for {error_type}")
                return {
                    'recovered': True,
                    'action': action.__name__
                }
            except Exception as recovery_error:
                logger.error(f"Recovery action failed for {error_type}: {recovery_error}")
                return {
                    'recovered': False,
                    'recovery_error': str(recovery_error)
                }

        # Default recovery strategies
        if error_type == 'ConnectionError':
            # Attempt to reconnect
            return self._attempt_reconnection(error_record)
        elif error_type == 'TimeoutError':
            # Increase timeout or retry with backoff
            return self._attempt_timeout_recovery(error_record)

        return {'recovered': False}

    def _attempt_reconnection(self, error_record: dict[str, Any]) -> dict[str, Any]:
        """Attempt to recover from connection errors"""
        context = error_record['context']
        service_name = context.get('service', 'unknown')

        # Check circuit breaker
        if service_name in self.circuit_breakers:
            breaker = self.circuit_breakers[service_name]
            if breaker.state == 'OPEN':
                return {'recovered': False, 'reason': 'Circuit breaker open'}

        # Attempt reconnection by testing the service
        logger.info(f"Attempting reconnection to {service_name}")

        try:
            if service_name in ('firebase', 'firestore', 'database'):
                from ..firebase_config import db
                db.collection('_health_check').limit(1).get()
                logger.info(f"Reconnection to {service_name} succeeded")
                return {'recovered': True, 'action': 'reconnection_success'}
            elif service_name == 'redis':
                from ..redis_config import get_redis_client
                client = get_redis_client()
                if client and client.ping():
                    logger.info(f"Reconnection to {service_name} succeeded")
                    return {'recovered': True, 'action': 'reconnection_success'}
        except Exception as reconnect_err:
            logger.warning(f"Reconnection to {service_name} failed: {reconnect_err}")

        return {'recovered': False, 'action': 'reconnection_failed'}

    def _attempt_timeout_recovery(self, error_record: dict[str, Any]) -> dict[str, Any]:
        """Attempt to recover from timeout errors by increasing tolerance."""
        context = error_record.get('context', {})
        current_timeout = context.get('timeout', 5.0)
        # Suggest a longer timeout for next attempt
        new_timeout = min(current_timeout * 1.5, 30.0)  # Cap at 30s
        logger.info(f"Timeout recovery: suggesting increased timeout {current_timeout}s -> {new_timeout}s")
        return {'recovered': True, 'action': 'timeout_backoff', 'suggested_timeout': new_timeout}

    def _attempt_retry(self, operation: Callable, context: dict[str, Any] | None,
                      max_retries: int) -> dict[str, Any]:
        """Attempt to retry operation with exponential backoff"""
        for attempt in range(max_retries):
            try:
                # Calculate backoff delay
                delay = (2 ** attempt) * 0.1  # Exponential backoff starting at 0.1s
                time.sleep(delay)

                result = operation()
                logger.info(f"Retry succeeded on attempt {attempt + 1}")
                return {
                    'success': True,
                    'attempt': attempt + 1,
                    'result': result
                }

            except Exception as retry_error:
                logger.warning(f"Retry attempt {attempt + 1}/{max_retries} failed: {retry_error}")
                continue

        return {'success': False, 'attempt': max_retries}

    def _should_alert(self, error_record: dict[str, Any]) -> bool:
        """Determine if error should trigger an alert"""
        error_type = error_record['error_type']
        error_count = self.error_counts.get(error_type, 0)

        # Check against thresholds
        threshold = self.error_thresholds.get(error_type, 1)

        # Check recent error rate (last 5 minutes)
        recent_errors = [
            e for e in self.error_history
            if (datetime.now(UTC) - e['timestamp']).total_seconds() < 300
            and e['error_type'] == error_type
        ]

        error_rate = len(recent_errors) / 5  # Errors per minute

        return error_rate > threshold or error_count > threshold * 10

    def _monitor_errors(self):
        """Background monitoring of error patterns"""
        while True:
            try:
                time.sleep(60)  # Check every minute

                # Analyze error patterns
                self._analyze_error_patterns()

                # Clean up old error history
                self._cleanup_error_history()

            except Exception as e:
                logger.error(f"Error in monitoring thread: {e}")

    def _analyze_error_patterns(self):
        """Analyze error patterns for proactive action"""
        # Check for error spikes
        recent_errors = [
            e for e in self.error_history
            if (datetime.now(UTC) - e['timestamp']).total_seconds() < 300  # Last 5 minutes
        ]

        if len(recent_errors) > 50:  # High error rate
            logger.warning(f"High error rate detected: {len(recent_errors)} errors in 5 minutes")

            # Group by error type
            error_types = {}
            for error in recent_errors:
                error_types[error['error_type']] = error_types.get(error['error_type'], 0) + 1

            # Log top error types
            sorted_errors = sorted(error_types.items(), key=lambda x: x[1], reverse=True)
            for error_type, count in sorted_errors[:5]:
                logger.warning(f"Top error: {error_type} ({count} occurrences)")

    def _cleanup_error_history(self):
        """Clean up old error records"""
        cutoff_time = datetime.now(UTC) - timedelta(hours=24)

        # Keep only errors from last 24 hours
        self.error_history = [
            error for error in self.error_history
            if error['timestamp'] > cutoff_time
        ]

    def get_error_stats(self) -> dict[str, Any]:
        """Get comprehensive error statistics"""
        total_errors = len(self.error_history)
        recent_errors = [
            e for e in self.error_history
            if (datetime.now(UTC) - e['timestamp']).total_seconds() < 3600  # Last hour
        ]

        error_types = {}
        for error in self.error_history:
            error_types[error['error_type']] = error_types.get(error['error_type'], 0) + 1

        return {
            'total_errors': total_errors,
            'recent_errors': len(recent_errors),
            'error_rate_per_hour': len(recent_errors),
            'error_types': error_types,
            'circuit_breakers': {
                name: {
                    'state': cb.state,
                    'failure_count': cb.failure_count,
                    'last_failure': cb.last_failure_time
                }
                for name, cb in self.circuit_breakers.items()
            },
            'recovery_actions': list(self.recovery_actions.keys())
        }

# Global error handler instance
error_handler = ErrorHandler()

def handle_errors(f: Callable) -> Callable:
    """Decorator for automatic error handling with real retry support"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            result = error_handler.handle_error(
                e,
                context={
                    'function': f.__name__,
                    'args': str(args) if args else None,
                    'kwargs': str(kwargs) if kwargs else None
                },
                should_retry=True,
                max_retries=3,
                retry_callable=lambda: f(*args, **kwargs)
            )

            if result.get('recovered') and 'result' in result:
                return result['result']

            # Re-raise if not recovered
            raise e

    return wrapper

def with_circuit_breaker(service_name: str):
    """Decorator to apply circuit breaker to function calls"""
    def decorator(f: Callable) -> Callable:
        # Get or create circuit breaker for this service
        if service_name not in error_handler.circuit_breakers:
            error_handler.register_circuit_breaker(service_name, CircuitBreaker())

        breaker = error_handler.circuit_breakers[service_name]

        @wraps(f)
        def wrapper(*args, **kwargs):
            return breaker.call(f, *args, **kwargs)

        return wrapper

    return decorator
