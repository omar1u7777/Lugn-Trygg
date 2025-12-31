"""
Connection Pool Service - Advanced connection pooling for high concurrency

Manages database connections, Redis connections, and external API connections
with automatic scaling, health checks, and performance optimization.
"""

import asyncio
import logging
import time
import threading
from typing import Any, Dict, List, Optional, Callable
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
import queue

logger = logging.getLogger(__name__)

class ConnectionPool:
    """Advanced connection pool with health monitoring and auto-scaling"""

    def __init__(self, pool_type: str, factory: Callable, max_size: int = 50,
                 min_size: int = 5, health_check_interval: int = 30,
                 connection_timeout: int = 10, max_idle_time: int = 300):
        """
        Initialize connection pool

        Args:
            pool_type: Type of connections (e.g., 'database', 'redis', 'api')
            factory: Function to create new connections
            max_size: Maximum pool size
            min_size: Minimum pool size
            health_check_interval: Seconds between health checks
            connection_timeout: Connection timeout in seconds
            max_idle_time: Maximum idle time before connection is closed
        """
        self.pool_type = pool_type
        self.factory = factory
        self.max_size = max_size
        self.min_size = min_size
        self.health_check_interval = health_check_interval
        self.connection_timeout = connection_timeout
        self.max_idle_time = max_idle_time

        # Connection storage
        self._available: queue.Queue = queue.Queue(maxsize=max_size)
        self._in_use: set = set()
        self._lock = threading.Lock()

        # Statistics
        self._created_count = 0
        self._destroyed_count = 0
        self._borrowed_count = 0
        self._returned_count = 0
        self._failed_count = 0

        # Health monitoring
        self._last_health_check = 0
        self._health_check_running = False

        # Auto-scaling
        self._scale_up_threshold = 0.8  # Scale up when 80% of connections in use
        self._scale_down_threshold = 0.2  # Scale down when 20% of connections idle

        # Initialize minimum connections
        self._initialize_pool()

        # Start background tasks
        self._start_background_tasks()

    def _initialize_pool(self):
        """Initialize minimum number of connections"""
        logger.info(f"Initializing {self.pool_type} connection pool with {self.min_size} connections")

        for _ in range(self.min_size):
            try:
                conn = self._create_connection()
                if conn:
                    self._available.put(conn)
            except Exception as e:
                logger.error(f"Failed to create initial connection: {e}")

    def _create_connection(self) -> Optional[Any]:
        """Create a new connection using the factory"""
        try:
            start_time = time.time()
            conn = self.factory()
            creation_time = time.time() - start_time

            if creation_time > self.connection_timeout:
                logger.warning(f"Connection creation took {creation_time:.2f}s, exceeding timeout")

            # Add metadata to connection
            if hasattr(conn, '_pool_metadata'):
                conn._pool_metadata = {
                    'created_at': datetime.now(timezone.utc),
                    'last_used': None,
                    'use_count': 0
                }

            self._created_count += 1
            logger.debug(f"Created new {self.pool_type} connection")
            return conn

        except Exception as e:
            self._failed_count += 1
            logger.error(f"Failed to create {self.pool_type} connection: {e}")
            return None

    def borrow_connection(self, timeout: float = 5.0) -> Optional[Any]:
        """
        Borrow a connection from the pool

        Args:
            timeout: Maximum time to wait for a connection

        Returns:
            Connection object or None if timeout
        """
        start_time = time.time()

        with self._lock:
            # Try to get available connection
            try:
                conn = self._available.get_nowait()
                self._in_use.add(conn)
                self._borrowed_count += 1

                # Update metadata
                if hasattr(conn, '_pool_metadata'):
                    conn._pool_metadata['last_used'] = datetime.now(timezone.utc)
                    conn._pool_metadata['use_count'] += 1

                # Check if we need to scale up
                self._check_scale_up()

                logger.debug(f"Borrowed {self.pool_type} connection in {time.time() - start_time:.3f}s")
                return conn

            except queue.Empty:
                # No available connections, try to create new one
                if len(self._in_use) < self.max_size:
                    conn = self._create_connection()
                    if conn:
                        self._in_use.add(conn)
                        self._borrowed_count += 1
                        return conn

                # Pool is full, wait for available connection
                pass

        # Wait for available connection
        try:
            conn = self._available.get(timeout=timeout)
            with self._lock:
                self._in_use.add(conn)
                self._borrowed_count += 1

                if hasattr(conn, '_pool_metadata'):
                    conn._pool_metadata['last_used'] = datetime.now(timezone.utc)
                    conn._pool_metadata['use_count'] += 1

            return conn

        except queue.Empty:
            logger.warning(f"Timeout waiting for {self.pool_type} connection after {timeout}s")
            return None

    def return_connection(self, conn: Any):
        """
        Return a connection to the pool

        Args:
            conn: Connection to return
        """
        if not conn:
            return

        with self._lock:
            if conn in self._in_use:
                self._in_use.remove(conn)
                self._returned_count += 1

                # Check connection health before returning
                if self._is_connection_healthy(conn):
                    # Check if connection has been idle too long
                    if hasattr(conn, '_pool_metadata'):
                        metadata = conn._pool_metadata
                        idle_time = (datetime.now(timezone.utc) - (metadata['last_used'] or metadata['created_at'])).total_seconds()

                        if idle_time > self.max_idle_time:
                            self._destroy_connection(conn)
                            return

                    # Return to available pool
                    try:
                        self._available.put_nowait(conn)
                    except queue.Full:
                        # Pool is full, destroy connection
                        self._destroy_connection(conn)
                else:
                    # Connection is unhealthy, destroy it
                    self._destroy_connection(conn)

                # Check if we need to scale down
                self._check_scale_down()

    def _destroy_connection(self, conn: Any):
        """Destroy a connection"""
        try:
            # Try to close the connection gracefully
            if hasattr(conn, 'close'):
                conn.close()
            elif hasattr(conn, 'disconnect'):
                conn.disconnect()

            self._destroyed_count += 1
            logger.debug(f"Destroyed {self.pool_type} connection")

        except Exception as e:
            logger.error(f"Error destroying {self.pool_type} connection: {e}")

    def _is_connection_healthy(self, conn: Any) -> bool:
        """Check if a connection is healthy"""
        try:
            # Basic health checks based on connection type
            if hasattr(conn, 'ping'):
                return conn.ping()
            elif hasattr(conn, 'health_check'):
                return conn.health_check()
            elif hasattr(conn, 'connected'):
                return conn.connected
            else:
                # For unknown connection types, assume healthy
                return True
        except Exception:
            return False

    def _check_scale_up(self):
        """Check if pool should scale up"""
        usage_ratio = len(self._in_use) / self.max_size

        if usage_ratio > self._scale_up_threshold:
            # Calculate how many new connections to create
            current_total = self._available.qsize() + len(self._in_use)
            target_size = min(self.max_size, current_total + 5)  # Add 5 connections

            connections_to_add = target_size - current_total

            if connections_to_add > 0:
                logger.info(f"Scaling up {self.pool_type} pool: adding {connections_to_add} connections")
                for _ in range(connections_to_add):
                    conn = self._create_connection()
                    if conn:
                        try:
                            self._available.put_nowait(conn)
                        except queue.Full:
                            self._destroy_connection(conn)

    def _check_scale_down(self):
        """Check if pool should scale down"""
        total_connections = self._available.qsize() + len(self._in_use)
        idle_ratio = self._available.qsize() / max(1, total_connections)

        if idle_ratio > self._scale_down_threshold and total_connections > self.min_size:
            # Remove excess idle connections
            connections_to_remove = min(
                self._available.qsize() - max(2, int(total_connections * 0.3)),
                total_connections - self.min_size
            )

            if connections_to_remove > 0:
                logger.info(f"Scaling down {self.pool_type} pool: removing {connections_to_remove} connections")
                for _ in range(connections_to_remove):
                    try:
                        conn = self._available.get_nowait()
                        self._destroy_connection(conn)
                    except queue.Empty:
                        break

    def _start_background_tasks(self):
        """Start background maintenance tasks"""
        # Health check thread
        health_thread = threading.Thread(target=self._health_check_worker, daemon=True)
        health_thread.start()

        # Statistics logging thread
        stats_thread = threading.Thread(target=self._stats_worker, daemon=True)
        stats_thread.start()

    def _health_check_worker(self):
        """Background worker for health checks"""
        while True:
            try:
                time.sleep(self.health_check_interval)

                if self._health_check_running:
                    continue

                self._health_check_running = True
                self._perform_health_checks()

            except Exception as e:
                logger.error(f"Error in health check worker: {e}")
            finally:
                self._health_check_running = False

    def _perform_health_checks(self):
        """Perform health checks on connections"""
        unhealthy_count = 0

        with self._lock:
            # Check in-use connections
            unhealthy_in_use = []
            for conn in self._in_use:
                if not self._is_connection_healthy(conn):
                    unhealthy_in_use.append(conn)
                    unhealthy_count += 1

            # Remove unhealthy in-use connections
            for conn in unhealthy_in_use:
                self._in_use.remove(conn)
                self._destroy_connection(conn)

            # Check available connections
            unhealthy_available = []
            temp_queue = queue.Queue()

            # Drain available queue and check each connection
            while not self._available.empty():
                try:
                    conn = self._available.get_nowait()
                    if self._is_connection_healthy(conn):
                        temp_queue.put(conn)
                    else:
                        unhealthy_count += 1
                        self._destroy_connection(conn)
                except queue.Empty:
                    break

            # Put healthy connections back
            while not temp_queue.empty():
                try:
                    self._available.put_nowait(temp_queue.get_nowait())
                except queue.Full:
                    break

        if unhealthy_count > 0:
            logger.warning(f"Removed {unhealthy_count} unhealthy {self.pool_type} connections")

        self._last_health_check = time.time()

    def _stats_worker(self):
        """Background worker for logging statistics"""
        while True:
            try:
                time.sleep(300)  # Log stats every 5 minutes

                stats = self.get_stats()
                logger.info(f"{self.pool_type} pool stats: {stats}")

            except Exception as e:
                logger.error(f"Error in stats worker: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """Get pool statistics"""
        with self._lock:
            total_connections = self._available.qsize() + len(self._in_use)

            return {
                'pool_type': self.pool_type,
                'available': self._available.qsize(),
                'in_use': len(self._in_use),
                'total': total_connections,
                'max_size': self.max_size,
                'min_size': self.min_size,
                'usage_ratio': len(self._in_use) / max(1, total_connections),
                'created': self._created_count,
                'destroyed': self._destroyed_count,
                'borrowed': self._borrowed_count,
                'returned': self._returned_count,
                'failed': self._failed_count,
                'last_health_check': self._last_health_check
            }

    def shutdown(self):
        """Shutdown the connection pool"""
        logger.info(f"Shutting down {self.pool_type} connection pool")

        with self._lock:
            # Close all available connections
            while not self._available.empty():
                try:
                    conn = self._available.get_nowait()
                    self._destroy_connection(conn)
                except queue.Empty:
                    break

            # Close all in-use connections (best effort)
            for conn in self._in_use.copy():
                try:
                    self._destroy_connection(conn)
                except Exception:
                    pass

            self._in_use.clear()

        logger.info(f"{self.pool_type} connection pool shutdown complete")

class ConnectionPoolManager:
    """Manager for multiple connection pools"""

    def __init__(self):
        self.pools: Dict[str, ConnectionPool] = {}
        self._lock = threading.Lock()

    def create_pool(self, name: str, pool_type: str, factory: Callable, **kwargs) -> ConnectionPool:
        """Create a new connection pool"""
        with self._lock:
            if name in self.pools:
                logger.warning(f"Pool {name} already exists, returning existing")
                return self.pools[name]

            pool = ConnectionPool(pool_type, factory, **kwargs)
            self.pools[name] = pool
            logger.info(f"Created connection pool: {name}")
            return pool

    def get_pool(self, name: str) -> Optional[ConnectionPool]:
        """Get a connection pool by name"""
        return self.pools.get(name)

    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all pools"""
        return {name: pool.get_stats() for name, pool in self.pools.items()}

    def shutdown_all(self):
        """Shutdown all connection pools"""
        logger.info("Shutting down all connection pools")

        for name, pool in self.pools.items():
            try:
                pool.shutdown()
            except Exception as e:
                logger.error(f"Error shutting down pool {name}: {e}")

        self.pools.clear()

# Global connection pool manager
pool_manager = ConnectionPoolManager()

def get_pool_manager() -> ConnectionPoolManager:
    """Get the global connection pool manager"""
    return pool_manager