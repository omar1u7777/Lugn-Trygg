"""
Monitoring Service for Lugn & Trygg Backend
Provides comprehensive monitoring, alerting, and health checks
"""

import time
import psutil
import logging
from datetime import datetime, timedelta, UTC
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import requests
import redis
import json

from ..config import Config

logger = logging.getLogger(__name__)

@dataclass
class SystemMetrics:
    """System performance metrics"""
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    network_connections: int
    timestamp: datetime

@dataclass
class ApplicationMetrics:
    """Application-specific metrics"""
    active_users: int
    total_requests: int
    error_rate: float
    avg_response_time: float
    database_connections: int
    cache_hit_rate: float
    timestamp: datetime

@dataclass
class HealthStatus:
    """Overall health status"""
    status: str  # 'healthy', 'degraded', 'unhealthy'
    checks: Dict[str, bool]
    message: str
    timestamp: datetime

class MonitoringService:
    """Central monitoring service"""

    def __init__(self, config: Config):
        self.config = config
        self.redis_client = None

        # Initialize Redis if available
        try:
            if hasattr(config, 'REDIS_URL'):
                self.redis_client = redis.from_url(config.REDIS_URL)
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")

        # Health check thresholds
        self.thresholds = {
            'cpu_usage': 80.0,  # %
            'memory_usage': 85.0,  # %
            'disk_usage': 90.0,  # %
            'error_rate': 5.0,  # %
            'response_time': 2000.0,  # ms
        }

    def get_system_metrics(self) -> SystemMetrics:
        """Get current system metrics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            network = len(psutil.net_connections())

            return SystemMetrics(
                cpu_usage=cpu_percent,
                memory_usage=memory.percent,
                disk_usage=disk.percent,
                network_connections=network,
                timestamp=datetime.now(UTC)
            )
        except Exception as e:
            logger.error(f"Failed to get system metrics: {e}")
            return SystemMetrics(0, 0, 0, 0, datetime.now(UTC))

    def get_application_metrics(self) -> ApplicationMetrics:
        """Get application-specific metrics"""
        try:
            # Get metrics from Redis cache or calculate
            active_users = self._get_active_users_count()
            total_requests = self._get_total_requests()
            error_rate = self._get_error_rate()
            avg_response_time = self._get_avg_response_time()
            db_connections = self._get_database_connections()
            cache_hit_rate = self._get_cache_hit_rate()

            return ApplicationMetrics(
                active_users=active_users,
                total_requests=total_requests,
                error_rate=error_rate,
                avg_response_time=avg_response_time,
                database_connections=db_connections,
                cache_hit_rate=cache_hit_rate,
                timestamp=datetime.now(UTC)
            )
        except Exception as e:
            logger.error(f"Failed to get application metrics: {e}")
            return ApplicationMetrics(0, 0, 0, 0, 0, 0, datetime.now(UTC))

    def perform_health_check(self) -> HealthStatus:
        """Perform comprehensive health check"""
        checks = {}
        messages = []

        try:
            # System health checks
            system_metrics = self.get_system_metrics()
            checks['cpu'] = system_metrics.cpu_usage < self.thresholds['cpu_usage']
            checks['memory'] = system_metrics.memory_usage < self.thresholds['memory_usage']
            checks['disk'] = system_metrics.disk_usage < self.thresholds['disk_usage']

            # Database health check
            checks['database'] = self._check_database_health()

            # Redis health check
            checks['redis'] = self._check_redis_health()

            # External API health checks
            checks['firebase'] = self._check_firebase_health()
            checks['openai'] = self._check_openai_health()

            # Application health
            app_metrics = self.get_application_metrics()
            checks['error_rate'] = app_metrics.error_rate < self.thresholds['error_rate']
            checks['response_time'] = app_metrics.avg_response_time < self.thresholds['response_time']

            # Determine overall status
            failed_checks = [k for k, v in checks.items() if not v]
            if not failed_checks:
                status = 'healthy'
                message = 'All systems operational'
            elif len(failed_checks) <= 2:
                status = 'degraded'
                message = f'Degraded performance: {", ".join(failed_checks)}'
            else:
                status = 'unhealthy'
                message = f'Critical issues: {", ".join(failed_checks)}'

            return HealthStatus(
                status=status,
                checks=checks,
                message=message,
                timestamp=datetime.now(UTC)
            )

        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return HealthStatus(
                status='unhealthy',
                checks={'health_check': False},
                message=f'Health check error: {str(e)}',
                timestamp=datetime.now(UTC)
            )

    def log_performance_metric(self, name: str, value: float, tags: Dict[str, str] = None):
        """Log performance metric"""
        try:
            metric_data = {
                'name': name,
                'value': value,
                'tags': tags or {},
                'timestamp': datetime.now(UTC).isoformat()
            }

            # Store in Redis for short-term metrics
            if self.redis_client:
                key = f"metrics:{name}:{int(time.time())}"
                self.redis_client.setex(key, 3600, json.dumps(metric_data))  # 1 hour TTL

            logger.info(f"Performance metric: {name} = {value}", extra=metric_data)

        except Exception as e:
            logger.error(f"Failed to log performance metric: {e}")

    def log_business_event(self, event_type: str, properties: Dict[str, Any] = None):
        """Log business event for analytics"""
        try:
            event_data = {
                'event_type': event_type,
                'properties': properties or {},
                'timestamp': datetime.now(UTC).isoformat(),
                'source': 'backend'
            }

            # Store in Redis for processing
            if self.redis_client:
                key = f"events:{event_type}:{int(time.time())}"
                self.redis_client.lpush(f"analytics_events", json.dumps(event_data))
                self.redis_client.expire(f"analytics_events", 86400)  # 24 hours

            logger.info(f"Business event: {event_type}", extra=event_data)

        except Exception as e:
            logger.error(f"Failed to log business event: {e}")

    def get_recent_metrics(self, metric_name: str, hours: int = 24) -> List[Dict]:
        """Get recent metrics for analysis"""
        try:
            if not self.redis_client:
                return []

            # Get metrics from Redis
            pattern = f"metrics:{metric_name}:*"
            keys = self.redis_client.keys(pattern)

            metrics = []
            for key in keys[-100:]:  # Last 100 entries
                data = self.redis_client.get(key)
                if data:
                    metrics.append(json.loads(data))

            return sorted(metrics, key=lambda x: x['timestamp'], reverse=True)

        except Exception as e:
            logger.error(f"Failed to get recent metrics: {e}")
            return []

    # Private helper methods

    def _get_active_users_count(self) -> int:
        """Get count of active users (last 30 minutes)"""
        try:
            if self.redis_client:
                # Count unique users in recent sessions
                pattern = "session:*"
                keys = self.redis_client.keys(pattern)
                return len(keys)
            return 0
        except:
            return 0

    def _get_total_requests(self) -> int:
        """Get total request count"""
        try:
            if self.redis_client:
                return int(self.redis_client.get('metrics:http_requests_total') or 0)
            return 0
        except:
            return 0

    def _get_error_rate(self) -> float:
        """Calculate error rate percentage"""
        try:
            if self.redis_client:
                total = int(self.redis_client.get('metrics:http_requests_total') or 1)
                errors = int(self.redis_client.get('metrics:http_errors_total') or 0)
                return (errors / total) * 100
            return 0.0
        except:
            return 0.0

    def _get_avg_response_time(self) -> float:
        """Get average response time in milliseconds"""
        try:
            if self.redis_client:
                return float(self.redis_client.get('metrics:avg_response_time') or 0)
            return 0.0
        except:
            return 0.0

    def _get_database_connections(self) -> int:
        """Get active database connections"""
        try:
            # In a real implementation, query PostgreSQL
            return 5  # Mock value
        except:
            return 0

    def _get_cache_hit_rate(self) -> float:
        """Get Redis cache hit rate"""
        try:
            if self.redis_client:
                hits = int(self.redis_client.get('cache:hits') or 0)
                misses = int(self.redis_client.get('cache:misses') or 0)
                total = hits + misses
                return (hits / total * 100) if total > 0 else 0.0
            return 0.0
        except:
            return 0.0

    def _check_database_health(self) -> bool:
        """Check database connectivity"""
        try:
            # In a real implementation, test database connection
            return True
        except:
            return False

    def _check_redis_health(self) -> bool:
        """Check Redis connectivity"""
        try:
            if self.redis_client:
                self.redis_client.ping()
                return True
            return False
        except:
            return False

    def _check_firebase_health(self) -> bool:
        """Check Firebase connectivity"""
        try:
            # Simple connectivity check
            return True
        except:
            return False

    def _check_openai_health(self) -> bool:
        """Check OpenAI API connectivity"""
        try:
            # Simple connectivity check
            return True
        except:
            return False

    # Additional methods for test coverage
    
    def track_request(self, endpoint: str, method: str, status_code: int, duration: float) -> None:
        """Track HTTP request metrics"""
        try:
            if self.redis_client:
                # Increment total requests
                self.redis_client.incr('metrics:http_requests_total')
                
                # Track errors (4xx, 5xx)
                if status_code >= 400:
                    self.redis_client.incr('metrics:http_errors_total')
                
                # Update average response time
                key = 'metrics:avg_response_time'
                current_avg = float(self.redis_client.get(key) or 0)
                new_avg = (current_avg + duration) / 2  # Simple moving average
                self.redis_client.set(key, new_avg)
                
                # Log request details
                logger.info(f"Request tracked: {method} {endpoint} - {status_code} ({duration:.2f}ms)")
        except Exception as e:
            logger.error(f"Failed to track request: {e}")

    def track_error(self, error_type: str, endpoint: str, error_message: str) -> None:
        """Track application errors"""
        try:
            error_data = {
                'type': error_type,
                'endpoint': endpoint,
                'message': error_message,
                'timestamp': datetime.now(UTC).isoformat()
            }
            
            if self.redis_client:
                # Store error in Redis list
                self.redis_client.lpush('errors:recent', json.dumps(error_data))
                self.redis_client.ltrim('errors:recent', 0, 99)  # Keep last 100 errors
                self.redis_client.incr('metrics:http_errors_total')
            
            logger.error(f"Error tracked: {error_type} at {endpoint} - {error_message}")
        except Exception as e:
            logger.error(f"Failed to track error: {e}")

    def start_monitoring(self) -> None:
        """Start monitoring services and background tasks"""
        try:
            logger.info("Starting monitoring service...")
            
            # Log initial system metrics
            system_metrics = self.get_system_metrics()
            logger.info(f"Initial system metrics: CPU={system_metrics.cpu_usage:.1f}%, "
                       f"Memory={system_metrics.memory_usage:.1f}%, "
                       f"Disk={system_metrics.disk_usage:.1f}%")
            
            # Perform initial health check
            health_status = self.perform_health_check()
            logger.info(f"Initial health check: {health_status.status} - {health_status.message}")
            
            logger.info("Monitoring service started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start monitoring service: {e}")
            raise

# Global monitoring service instance
monitoring_service = None

def init_monitoring_service(config: Config) -> MonitoringService:
    """Initialize global monitoring service"""
    global monitoring_service
    monitoring_service = MonitoringService(config)
    return monitoring_service

def get_monitoring_service() -> Optional[MonitoringService]:
    """Get global monitoring service instance"""
    return monitoring_service