"""
Redis configuration module for Lugn & Trygg backend caching layer.
Provides Redis client setup and connection pooling for high-performance caching.
"""

import logging
import redis
from redis.connection import ConnectionPool
from typing import Optional, Any
from .config import config

logger = logging.getLogger(__name__)

# Global Redis client instance
redis_client: Optional[redis.Redis] = None
redis_pool: Optional[ConnectionPool] = None


def create_redis_pool() -> ConnectionPool:
    """
    Create Redis connection pool with optimized settings for high concurrency.

    Returns:
        ConnectionPool: Configured Redis connection pool
    """
    pool_kwargs = {
        "host": config.REDIS_HOST,
        "port": config.REDIS_PORT,
        "db": config.REDIS_DB,
        "max_connections": config.REDIS_MAX_CONNECTIONS,
        "decode_responses": True,  # Return strings instead of bytes
        "socket_timeout": 5,  # 5 second timeout
        "socket_connect_timeout": 5,
        "socket_keepalive": True,
        "health_check_interval": 30,  # Health check every 30 seconds
        "retry_on_timeout": True,
    }

    # Add password if configured
    if config.REDIS_PASSWORD:
        pool_kwargs["password"] = config.REDIS_PASSWORD

    # Add SSL if configured
    if config.REDIS_SSL:
        pool_kwargs["ssl"] = True
        pool_kwargs["ssl_cert_reqs"] = None  # For self-signed certificates

    return ConnectionPool(**pool_kwargs)


def initialize_redis() -> bool:
    """
    Initialize Redis client with connection pooling.

    Returns:
        bool: True if initialization successful
    """
    global redis_client, redis_pool

    try:
        if redis_pool is None:
            redis_pool = create_redis_pool()

        if redis_client is None:
            redis_client = redis.Redis(connection_pool=redis_pool)

        # Test connection
        redis_client.ping()
        logger.info("✅ Redis connection established successfully")
        return True

    except redis.ConnectionError as e:
        logger.error(f"❌ Redis connection failed: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Redis initialization error: {e}")
        return False


def get_redis_client() -> Optional[redis.Redis]:
    """
    Get the Redis client instance.

    Returns:
        redis.Redis: Redis client instance or None if not initialized
    """
    if redis_client is None:
        if not initialize_redis():
            return None
    return redis_client


def close_redis_connection():
    """Close Redis connection pool gracefully."""
    global redis_client, redis_pool
    try:
        if redis_client:
            redis_client.close()
        if redis_pool:
            redis_pool.disconnect()
        logger.info("✅ Redis connection closed")
    except Exception as e:
        logger.error(f"Error closing Redis connection: {e}")


# Initialize Redis on module import
initialize_redis()