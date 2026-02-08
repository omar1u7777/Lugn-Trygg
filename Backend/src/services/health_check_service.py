"""
Health Check Service - Comprehensive application health monitoring

Provides detailed health checks for all system components including:
- Database connectivity
- External service dependencies
- Cache systems
- Message queues
- File systems
- Performance metrics
"""

import asyncio
import logging
import time
import psutil
import socket
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class HealthCheck:
    """Individual health check definition"""

    def __init__(self, name: str, check_func: Callable, timeout: float = 5.0,
                 interval: int = 30, critical: bool = False):
        self.name = name
        self.check_func = check_func
        self.timeout = timeout
        self.interval = interval
        self.critical = critical
        self.last_check = 0
        self.last_result = None
        self.last_error = None

    async def run(self) -> Dict[str, Any]:
        """Run the health check"""
        start_time = time.time()

        try:
            # Run check with timeout
            if asyncio.iscoroutinefunction(self.check_func):
                result = await asyncio.wait_for(self.check_func(), timeout=self.timeout)
            else:
                # Run sync function in thread pool
                loop = asyncio.get_event_loop()
                result = await asyncio.wait_for(
                    loop.run_in_executor(None, self.check_func),
                    timeout=self.timeout
                )

            response_time = time.time() - start_time

            self.last_result = {
                'status': 'healthy',
                'response_time': response_time,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'details': result if isinstance(result, dict) else {}
            }

        except asyncio.TimeoutError:
            self.last_result = {
                'status': 'unhealthy',
                'error': 'Timeout',
                'response_time': self.timeout,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
        except Exception as e:
            self.last_result = {
                'status': 'unhealthy',
                'error': str(e),
                'response_time': time.time() - start_time,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

        self.last_check = time.time()
        return self.last_result

class HealthCheckService:
    """Comprehensive health check service"""

    def __init__(self):
        self.checks: Dict[str, HealthCheck] = {}
        self.overall_status = 'unknown'
        self.last_overall_check = 0

        # Register default health checks
        self._register_default_checks()

    def register_check(self, name: str, check_func: Callable, **kwargs):
        """Register a custom health check"""
        check = HealthCheck(name, check_func, **kwargs)
        self.checks[name] = check
        logger.info(f"Registered health check: {name}")

    def _register_default_checks(self):
        """Register default system health checks"""
        # System resource checks
        self.register_check('cpu_usage', self._check_cpu_usage, critical=False)
        self.register_check('memory_usage', self._check_memory_usage, critical=True)
        self.register_check('disk_usage', self._check_disk_usage, critical=True)

        # Network checks
        self.register_check('network_connectivity', self._check_network_connectivity, critical=True)

        # Application checks
        self.register_check('application_startup', self._check_application_startup, critical=True)

    async def run_all_checks(self) -> Dict[str, Any]:
        """Run all health checks and return comprehensive report"""
        start_time = time.time()

        results = {}
        critical_failures = []

        # Run all checks concurrently
        tasks = []
        for name, check in self.checks.items():
            # Only run checks that are due
            if time.time() - check.last_check >= check.interval:
                tasks.append(self._run_check_with_metadata(name, check))

        if tasks:
            check_results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in check_results:
                if isinstance(result, Exception):
                    logger.error(f"Health check error: {result}")
                    continue
                
                # Type check: result should be tuple, not Exception
                if not isinstance(result, tuple) or len(result) != 2:
                    logger.error(f"Invalid health check result format: {result}")
                    continue

                name, check_result = result
                results[name] = check_result

                if check_result['status'] == 'unhealthy' and self.checks[name].critical:
                    critical_failures.append(name)

        # Determine overall status
        if critical_failures:
            overall_status = 'critical'
        elif any(r.get('status') == 'unhealthy' for r in results.values()):
            overall_status = 'degraded'
        elif results:
            overall_status = 'healthy'
        else:
            overall_status = 'unknown'

        self.overall_status = overall_status
        self.last_overall_check = time.time()

        # Create comprehensive report
        report = {
            'status': overall_status,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'response_time': time.time() - start_time,
            'checks': results,
            'summary': {
                'total_checks': len(self.checks),
                'passed_checks': len([r for r in results.values() if r.get('status') == 'healthy']),
                'failed_checks': len([r for r in results.values() if r.get('status') == 'unhealthy']),
                'critical_failures': critical_failures
            },
            'system_info': await self._get_system_info()
        }

        return report

    async def _run_check_with_metadata(self, name: str, check: HealthCheck) -> tuple:
        """Run a health check and return with metadata"""
        result = await check.run()
        return name, result

    async def get_health_status(self) -> Dict[str, Any]:
        """Get current health status (cached if recent)"""
        # Return cached result if less than 30 seconds old
        if time.time() - self.last_overall_check < 30:
            return {
                'status': self.overall_status,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'cached': True
            }

        # Run fresh checks
        return await self.run_all_checks()

    async def _get_system_info(self) -> Dict[str, Any]:
        """Get basic system information"""
        try:
            return {
                'cpu_count': psutil.cpu_count(),
                'cpu_percent': psutil.cpu_percent(interval=1),
                'memory_total': psutil.virtual_memory().total,
                'memory_available': psutil.virtual_memory().available,
                'memory_percent': psutil.virtual_memory().percent,
                'disk_total': psutil.disk_usage('/').total,
                'disk_free': psutil.disk_usage('/').free,
                'disk_percent': psutil.disk_usage('/').percent,
                'uptime': time.time() - psutil.boot_time()
            }
        except Exception as e:
            logger.error(f"Error getting system info: {e}")
            return {'error': str(e)}

    # Default health check implementations

    def _check_cpu_usage(self) -> Dict[str, Any]:
        """Check CPU usage"""
        cpu_percent = psutil.cpu_percent(interval=1)

        if cpu_percent > 90:
            status = 'high'
        elif cpu_percent > 70:
            status = 'warning'
        else:
            status = 'normal'

        return {
            'cpu_percent': cpu_percent,
            'status': status,
            'thresholds': {'warning': 70, 'critical': 90}
        }

    def _check_memory_usage(self) -> Dict[str, Any]:
        """Check memory usage"""
        memory = psutil.virtual_memory()
        memory_percent = memory.percent

        if memory_percent > 90:
            status = 'critical'
        elif memory_percent > 80:
            status = 'warning'
        else:
            status = 'normal'

        return {
            'memory_percent': memory_percent,
            'memory_used': memory.used,
            'memory_total': memory.total,
            'status': status,
            'thresholds': {'warning': 80, 'critical': 90}
        }

    def _check_disk_usage(self) -> Dict[str, Any]:
        """Check disk usage"""
        disk = psutil.disk_usage('/')
        disk_percent = disk.percent

        if disk_percent > 95:
            status = 'critical'
        elif disk_percent > 85:
            status = 'warning'
        else:
            status = 'normal'

        return {
            'disk_percent': disk_percent,
            'disk_used': disk.used,
            'disk_total': disk.total,
            'disk_free': disk.free,
            'status': status,
            'thresholds': {'warning': 85, 'critical': 95}
        }

    def _check_network_connectivity(self) -> Dict[str, Any]:
        """Check basic network connectivity"""
        try:
            # Try to connect to a reliable host (Google DNS)
            socket.create_connection(("8.8.8.8", 53), timeout=5)
            return {
                'connectivity': True,
                'status': 'connected',
                'latency': 'unknown'  # Could implement ping check
            }
        except Exception as e:
            return {
                'connectivity': False,
                'status': 'disconnected',
                'error': str(e)
            }

    def _check_application_startup(self) -> Dict[str, Any]:
        """Check if application started properly"""
        # This would check application-specific startup indicators
        # For now, just return healthy if the health check service is running
        return {
            'startup_complete': True,
            'status': 'running',
            'uptime': time.time() - getattr(self, '_start_time', time.time())
        }

    # Specialized health checks for different services

    def register_database_check(self, check_func: Callable):
        """Register database connectivity check"""
        self.register_check('database', check_func, critical=True, interval=15)

    def register_cache_check(self, check_func: Callable):
        """Register cache service check"""
        self.register_check('cache', check_func, critical=False, interval=30)

    def register_external_service_check(self, service_name: str, check_func: Callable):
        """Register external service check"""
        self.register_check(f'external_{service_name}', check_func, critical=False, interval=60)

    def register_custom_check(self, name: str, check_func: Callable, critical: bool = False,
                             timeout: float = 5.0, interval: int = 30):
        """Register a custom health check"""
        self.register_check(name, check_func, critical=critical, timeout=timeout, interval=interval)

    async def get_detailed_report(self) -> Dict[str, Any]:
        """Get detailed health report with trends and recommendations"""
        basic_report = await self.run_all_checks()

        # Add trend analysis
        trends = await self._analyze_health_trends()

        # Add recommendations
        recommendations = self._generate_recommendations(basic_report)

        return {
            **basic_report,
            'trends': trends,
            'recommendations': recommendations
        }

    async def _analyze_health_trends(self) -> Dict[str, Any]:
        """Analyze health trends over time"""
        # This would analyze historical health data
        # For now, return placeholder
        return {
            'overall_trend': 'stable',
            'improving_checks': [],
            'degrading_checks': [],
            'period': '24h'
        }

    def _generate_recommendations(self, report: Dict[str, Any]) -> List[str]:
        """Generate health recommendations based on report"""
        recommendations = []

        if report['status'] == 'critical':
            recommendations.append("Immediate attention required - critical systems failing")

        failed_checks = [name for name, result in report['checks'].items()
                        if result.get('status') == 'unhealthy']

        for check_name in failed_checks:
            if 'memory' in check_name:
                recommendations.append("Consider increasing memory allocation or optimizing memory usage")
            elif 'disk' in check_name:
                recommendations.append("Monitor disk space and consider cleanup or expansion")
            elif 'database' in check_name:
                recommendations.append("Check database connectivity and performance")
            elif 'network' in check_name:
                recommendations.append("Investigate network connectivity issues")

        system_info = report.get('system_info', {})
        if system_info.get('memory_percent', 0) > 85:
            recommendations.append("High memory usage detected - consider optimization")

        if system_info.get('cpu_percent', 0) > 80:
            recommendations.append("High CPU usage detected - consider scaling or optimization")

        return recommendations

# Global health check service instance
health_check_service = HealthCheckService()

# Convenience functions
async def get_health_status():
    """Get current health status"""
    return await health_check_service.get_health_status()

async def run_health_checks():
    """Run all health checks"""
    return await health_check_service.run_all_checks()

def register_health_check(name: str, check_func: Callable, **kwargs):
    """Register a health check"""
    health_check_service.register_check(name, check_func, **kwargs)