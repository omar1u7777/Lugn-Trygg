"""
API Versioning System for Lugn & Trygg
Semantic versioning with backward compatibility and migration support
"""

import re
from functools import wraps
from flask import request, jsonify, g, current_app
from typing import Dict, List, Optional, Callable, Any
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class APIVersion:
    """Represents an API version with metadata"""

    def __init__(self, major: int, minor: int, patch: int = 0,
                 release_date: Optional[datetime] = None,
                 deprecated: bool = False,
                 sunset_date: Optional[datetime] = None):
        self.major = major
        self.minor = minor
        self.patch = patch
        self.release_date = release_date or datetime.utcnow()
        self.deprecated = deprecated
        self.sunset_date = sunset_date
        self.version_string = f"v{major}.{minor}.{patch}"

    def __str__(self):
        return self.version_string

    def __eq__(self, other):
        if isinstance(other, APIVersion):
            return (self.major, self.minor, self.patch) == (other.major, other.minor, other.patch)
        return False

    def __lt__(self, other):
        if isinstance(other, APIVersion):
            return (self.major, self.minor, self.patch) < (other.major, other.minor, other.patch)
        return False

    def __le__(self, other):
        return self < other or self == other

    def __gt__(self, other):
        return not self <= other

    def __ge__(self, other):
        return not self < other

class APIVersionManager:
    """Manages API versions and compatibility"""

    def __init__(self):
        self.versions: Dict[str, APIVersion] = {}
        self.current_version = None
        self.supported_versions: List[APIVersion] = []
        self.version_routes: Dict[str, Dict] = {}  # version -> {route -> handler}

        # Initialize with current version
        self.add_version(APIVersion(1, 0, 0))

    def add_version(self, version: APIVersion):
        """Add a new API version"""
        self.versions[version.version_string] = version
        self.supported_versions.append(version)
        self.supported_versions.sort(reverse=True)  # Latest first

        if not self.current_version or version > self.current_version:
            self.current_version = version

        logger.info(f"✅ Added API version: {version}")

    def get_version(self, version_string: str) -> Optional[APIVersion]:
        """Get version object by string"""
        return self.versions.get(version_string)

    def parse_version_string(self, version_str: str) -> Optional[APIVersion]:
        """Parse version string like 'v1.0.0' or '1.0'"""
        # Remove 'v' prefix if present
        version_str = version_str.lstrip('v')

        # Match semantic version pattern
        match = re.match(r'^(\d+)\.(\d+)(?:\.(\d+))?$', version_str)
        if match:
            major, minor = int(match.group(1)), int(match.group(2))
            patch = int(match.group(3)) if match.group(3) else 0
            return APIVersion(major, minor, patch)

        return None

    def is_version_supported(self, version: APIVersion) -> bool:
        """Check if version is still supported"""
        if version.deprecated and version.sunset_date:
            return datetime.utcnow() < version.sunset_date
        return version in self.supported_versions

    def get_latest_version(self) -> APIVersion:
        """Get the latest supported version"""
        return self.current_version

    def register_versioned_route(self, version: str, route: str, handler: Callable):
        """Register a route for a specific version"""
        if version not in self.version_routes:
            self.version_routes[version] = {}

        self.version_routes[version][route] = handler

    def get_versioned_handler(self, version: str, route: str) -> Optional[Callable]:
        """Get handler for specific version and route"""
        version_routes = self.version_routes.get(version, {})
        return version_routes.get(route)

# Global version manager
version_manager = APIVersionManager()

def api_version(version_string: str, deprecated: bool = False) -> Callable:
    """
    Decorator to specify API version for a route

    Args:
        version_string: Version like "v1.0.0" or "1.0"
        deprecated: Whether this version is deprecated
    """
    def decorator(f):
        # Parse and register version
        version = version_manager.parse_version_string(version_string)
        if version:
            version.deprecated = deprecated
            version_manager.add_version(version)

            # Store version info on function
            f._api_version = version
            f._version_string = version_string

        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Store version info in request context
            g.api_version = version
            g.api_version_string = version_string

            return f(*args, **kwargs)

        return decorated_function
    return decorator

def versioned_route(rule: str, methods: List[str] = None, **options):
    """
    Decorator for versioned routes that automatically handles version routing

    Usage:
        @versioned_route('/users', methods=['GET'])
        @api_version('v1.0.0')
        def get_users_v1():
            pass

        @versioned_route('/users', methods=['GET'])
        @api_version('v2.0.0')
        def get_users_v2():
            pass
    """
    if methods is None:
        methods = ['GET']

    def decorator(f):
        # Extract version from function if available
        version = getattr(f, '_api_version', None)
        if version:
            # Register with version manager
            version_manager.register_versioned_route(
                version.version_string, rule, f
            )

        @wraps(f)
        def decorated_function(*args, **kwargs):
            return f(*args, **kwargs)

        # Store route info
        decorated_function._route_rule = rule
        decorated_function._route_methods = methods
        decorated_function._route_options = options

        return decorated_function
    return decorator

def extract_requested_version() -> Optional[APIVersion]:
    """
    Extract API version from request headers or URL

    Supports:
    - Accept header: application/vnd.lugntrygg.v1+json
    - Custom header: X-API-Version: v1.0.0
    - URL path: /api/v1.0/users
    - Query param: ?version=v1.0.0
    """
    # Check Accept header for vendor media type
    accept = request.headers.get('Accept', '')
    if 'vnd.lugntrygg.' in accept:
        version_match = re.search(r'vnd\.lugntrygg\.v?(\d+\.\d+(?:\.\d+)?)', accept)
        if version_match:
            return version_manager.parse_version_string(version_match.group(1))

    # Check custom API version header
    api_version_header = request.headers.get('X-API-Version')
    if api_version_header:
        return version_manager.parse_version_string(api_version_header)

    # Check URL path for version prefix
    if request.path.startswith('/api/v'):
        path_match = re.match(r'/api/v(\d+\.\d+(?:\.\d+)?)', request.path)
        if path_match:
            return version_manager.parse_version_string(path_match.group(1))

    # Check query parameter
    version_param = request.args.get('version')
    if version_param:
        return version_manager.parse_version_string(version_param)

    return None

def require_version(min_version: str = None, max_version: str = None) -> Callable:
    """
    Decorator to require specific API version range

    Args:
        min_version: Minimum required version (inclusive)
        max_version: Maximum allowed version (inclusive)
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            requested_version = extract_requested_version()

            if not requested_version:
                # Default to latest version if none specified
                requested_version = version_manager.get_latest_version()

            # Check minimum version
            if min_version:
                min_ver = version_manager.parse_version_string(min_version)
                if min_ver and requested_version < min_ver:
                    return jsonify({
                        'error': 'API version too old',
                        'message': f'Minimum required version is {min_version}',
                        'current_version': str(requested_version),
                        'min_version': min_version
                    }), 400

            # Check maximum version
            if max_version:
                max_ver = version_manager.parse_version_string(max_version)
                if max_ver and requested_version > max_ver:
                    return jsonify({
                        'error': 'API version not supported',
                        'message': f'Maximum supported version is {max_version}',
                        'current_version': str(requested_version),
                        'max_version': max_version
                    }), 400

            # Check if version is still supported
            if not version_manager.is_version_supported(requested_version):
                return jsonify({
                    'error': 'API version deprecated',
                    'message': f'Version {requested_version} is no longer supported',
                    'supported_versions': [str(v) for v in version_manager.supported_versions],
                    'latest_version': str(version_manager.get_latest_version())
                }), 410  # Gone

            # Store version in context
            g.api_version = requested_version
            g.api_version_string = str(requested_version)

            return f(*args, **kwargs)

        return decorated_function
    return decorator

def version_compatibility_layer(old_version: str, new_version: str) -> Callable:
    """
    Decorator to provide backward compatibility between versions

    Args:
        old_version: Version to maintain compatibility with
        new_version: Current version with breaking changes
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            requested_version = extract_requested_version() or version_manager.get_latest_version()

            old_ver = version_manager.parse_version_string(old_version)
            new_ver = version_manager.parse_version_string(new_version)

            if old_ver and requested_version <= old_ver:
                # Apply compatibility transformations
                return apply_version_compatibility(f, old_version, *args, **kwargs)
            else:
                # Use new version behavior
                return f(*args, **kwargs)

        return decorated_function
    return decorator

def apply_version_compatibility(func: Callable, target_version: str, *args, **kwargs) -> Any:
    """
    Apply compatibility transformations for older API versions

    This function transforms responses to maintain backward compatibility
    """
    result = func(*args, **kwargs)

    # Handle different response formats
    if isinstance(result, tuple):
        response_data, status_code = result
    else:
        response_data, status_code = result, 200

    if isinstance(response_data, dict):
        # Apply version-specific transformations
        if target_version.startswith('v1.0'):
            # v1.0 compatibility transformations
            response_data = transform_v1_compatibility(response_data)

    return response_data, status_code

def transform_v1_compatibility(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform response data for v1.0 compatibility

    Example transformations:
    - Rename fields
    - Change data structures
    - Add deprecated fields
    """
    transformed = data.copy()

    # Example: Rename 'mood_value' to 'mood' for v1.0
    if 'mood_value' in transformed:
        transformed['mood'] = transformed.pop('mood_value')

    # Example: Flatten nested objects for v1.0
    if 'user' in transformed and isinstance(transformed['user'], dict):
        user_data = transformed['user']
        if 'profile' in user_data:
            transformed['user'].update(user_data['profile'])
            del transformed['user']['profile']

    return transformed

def get_version_info() -> Dict[str, Any]:
    """Get comprehensive version information"""
    return {
        'current_version': str(version_manager.current_version),
        'supported_versions': [str(v) for v in version_manager.supported_versions],
        'deprecated_versions': [str(v) for v in version_manager.supported_versions if v.deprecated],
        'latest_version': str(version_manager.get_latest_version()),
        'version_count': len(version_manager.versions)
    }

# Initialize with some versions
version_manager.add_version(APIVersion(1, 0, 0, deprecated=False))
version_manager.add_version(APIVersion(1, 1, 0, deprecated=False))
version_manager.add_version(APIVersion(2, 0, 0, deprecated=False))

__all__ = [
    'APIVersion',
    'APIVersionManager',
    'version_manager',
    'api_version',
    'versioned_route',
    'extract_requested_version',
    'require_version',
    'version_compatibility_layer',
    'get_version_info'
]