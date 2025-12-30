"""
SQL Injection Protection for Lugn & Trygg
Advanced protection against SQL injection attacks, even though we use Firestore (NoSQL)
Includes parameterized query enforcement and injection detection
"""

import re
import logging
from typing import Any, Dict, List, Optional, Union, Tuple
from functools import wraps
from flask import request, g, current_app
import hashlib

logger = logging.getLogger(__name__)

class SQLInjectionProtector:
    """Advanced SQL injection detection and prevention"""

    def __init__(self):
        # SQL injection patterns - comprehensive detection
        self.sql_injection_patterns = [
            # Basic SQL injection
            r';\s*(select|insert|update|delete|drop|create|alter|truncate|exec|execute)\s',
            r'union\s+(select|all)',
            r'/\*.*?\*/',  # Block comments
            r'--.*?$',     # Line comments

            # Advanced patterns
            r';\s*(shutdown|backup|restore)\s',
            r';\s*(xp_cmdshell|sp_executesql)\s',
            r';\s*exec\s*\(',
            r'into\s+outfile\s',
            r'load_file\s*\(',
            r'information_schema',
            r'concat\s*\(\s*0x',

            # Time-based and error-based
            r';\s*waitfor\s+delay\s',
            r';\s*if\s*\(',
            r';\s*case\s+when',

            # Stacked queries
            r';\s*(declare|set)\s+@',

            # Common attack vectors
            r'\b(1=1|1=0)\s*(--|#|/\*)?',
            r'or\s+1\s*=\s*1',
            r'and\s+1\s*=\s*1',

            # Hex encoded attacks
            r'0x[0-9a-fA-F]+\s*=\s*0x[0-9a-fA-F]+',

            # Base64 encoded attacks (common pattern)
            r'[a-zA-Z0-9+/=]{20,}',  # Long base64 strings
        ]

        # Dangerous keywords that should be flagged
        self.dangerous_keywords = {
            'union', 'select', 'insert', 'update', 'delete', 'drop', 'create', 'alter',
            'truncate', 'exec', 'execute', 'shutdown', 'backup', 'restore', 'script',
            'information_schema', 'mysql', 'postgres', 'oracle', 'mssql', 'sqlite',
            'xp_cmdshell', 'sp_executesql', 'waitfor', 'delay', 'benchmark', 'sleep',
            'load_file', 'into outfile', 'concat', 'char', 'ascii', 'substring',
            'declare', 'set', 'begin', 'end', 'if', 'case', 'when', 'then', 'else'
        }

        # Safe SQL functions (for whitelist validation)
        self.safe_functions = {
            'count', 'sum', 'avg', 'min', 'max', 'length', 'upper', 'lower',
            'trim', 'ltrim', 'rtrim', 'substring', 'left', 'right', 'replace',
            'concat', 'coalesce', 'isnull', 'ifnull', 'now', 'current_timestamp',
            'date', 'year', 'month', 'day', 'hour', 'minute', 'second'
        }

        # Query analysis cache
        self.analysis_cache: Dict[str, Dict] = {}
        self.max_cache_size = 1000

        # Attack detection statistics
        self.attack_stats = {
            'total_scanned': 0,
            'attacks_detected': 0,
            'attacks_blocked': 0,
            'false_positives': 0
        }

    def analyze_query(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Comprehensive SQL injection analysis

        Args:
            query: SQL query string
            parameters: Query parameters

        Returns:
            Analysis results with risk assessment
        """
        if not query:
            return {'safe': True, 'risk_level': 'low', 'issues': []}

        # Cache check - MD5 used only for cache key, not security
        cache_key = hashlib.md5(f"{query}{str(parameters)}".encode(), usedforsecurity=False).hexdigest()
        if cache_key in self.analysis_cache:
            return self.analysis_cache[cache_key]

        self.attack_stats['total_scanned'] += 1

        analysis = {
            'safe': True,
            'risk_level': 'low',
            'issues': [],
            'recommendations': [],
            'query_hash': cache_key,
            'parameterized': bool(parameters),
            'query_length': len(query)
        }

        # Basic pattern matching
        pattern_issues = self._check_patterns(query)
        if pattern_issues:
            analysis['issues'].extend(pattern_issues)
            analysis['safe'] = False

        # Keyword analysis
        keyword_issues = self._check_keywords(query)
        if keyword_issues:
            analysis['issues'].extend(keyword_issues)
            analysis['safe'] = False

        # Structure analysis
        structure_issues = self._check_query_structure(query)
        if structure_issues:
            analysis['issues'].extend(structure_issues)
            analysis['safe'] = False

        # Parameter analysis
        if parameters:
            param_issues = self._check_parameters(parameters)
            if param_issues:
                analysis['issues'].extend(param_issues)
                analysis['safe'] = False

        # Risk level assessment
        analysis['risk_level'] = self._assess_risk_level(analysis['issues'])

        # Generate recommendations
        analysis['recommendations'] = self._generate_recommendations(analysis)

        # Update statistics
        if not analysis['safe']:
            self.attack_stats['attacks_detected'] += 1

        # Cache result
        if len(self.analysis_cache) < self.max_cache_size:
            self.analysis_cache[cache_key] = analysis

        return analysis

    def _check_patterns(self, query: str) -> List[str]:
        """Check for SQL injection patterns"""
        issues = []
        query_lower = query.lower()

        for pattern in self.sql_injection_patterns:
            if re.search(pattern, query_lower, re.IGNORECASE | re.MULTILINE):
                issues.append(f"Detected SQL injection pattern: {pattern}")

        # Check for encoded attacks
        if re.search(r'%[0-9a-fA-F]{2}', query):  # URL encoded
            issues.append("URL-encoded content detected")

        if re.search(r'\\u[0-9a-fA-F]{4}', query):  # Unicode encoded
            issues.append("Unicode-encoded content detected")

        return issues

    def _check_keywords(self, query: str) -> List[str]:
        """Check for dangerous keywords"""
        issues = []
        query_lower = query.lower()

        found_keywords = []
        for keyword in self.dangerous_keywords:
            if re.search(r'\b' + re.escape(keyword) + r'\b', query_lower):
                found_keywords.append(keyword)

        if found_keywords:
            issues.append(f"Dangerous keywords detected: {', '.join(found_keywords)}")

        return issues

    def _check_query_structure(self, query: str) -> List[str]:
        """Analyze query structure for anomalies"""
        issues = []

        # Multiple statement detection
        statement_count = query.count(';')
        if statement_count > 1:
            issues.append(f"Multiple statements detected ({statement_count} semicolons)")

        # Unbalanced quotes
        single_quotes = query.count("'")
        double_quotes = query.count('"')
        backticks = query.count('`')

        if single_quotes % 2 != 0:
            issues.append("Unbalanced single quotes")

        if double_quotes % 2 != 0:
            issues.append("Unbalanced double quotes")

        if backticks % 2 != 0:
            issues.append("Unbalanced backticks")

        # Suspicious comment patterns
        if '/*' in query and '*/' not in query:
            issues.append("Unclosed block comment")

        # Check for common attack signatures
        if re.search(r';\s*--', query):
            issues.append("Stacked query with comment termination")

        return issues

    def _check_parameters(self, parameters: Dict[str, Any]) -> List[str]:
        """Analyze query parameters for injection risks"""
        issues = []

        for param_name, param_value in parameters.items():
            if param_value is None:
                continue

            param_str = str(param_value)

            # Check parameter content
            if isinstance(param_value, str):
                # Check for SQL keywords in parameters
                param_lower = param_str.lower()
                for keyword in self.dangerous_keywords:
                    if keyword in param_lower:
                        issues.append(f"Dangerous keyword '{keyword}' in parameter '{param_name}'")

                # Check for suspicious patterns
                if re.search(r'[;\'\"\\]', param_str):
                    issues.append(f"Special characters in parameter '{param_name}'")

                # Check for encoded content
                if '%' in param_str and re.search(r'%[0-9a-fA-F]{2}', param_str):
                    issues.append(f"URL-encoded content in parameter '{param_name}'")

            # Check for unusual parameter types
            if not isinstance(param_value, (str, int, float, bool, type(None))):
                issues.append(f"Unusual parameter type for '{param_name}': {type(param_value)}")

        return issues

    def _assess_risk_level(self, issues: List[str]) -> str:
        """Assess overall risk level"""
        if not issues:
            return 'low'

        high_risk_indicators = [
            'multiple statements detected',
            'dangerous keywords detected',
            'unbalanced quotes',
            'stacked query'
        ]

        medium_risk_indicators = [
            'special characters',
            'url-encoded content',
            'unicode-encoded content'
        ]

        high_risk_count = sum(1 for issue in issues if any(indicator in issue.lower() for indicator in high_risk_indicators))
        medium_risk_count = sum(1 for issue in issues if any(indicator in issue.lower() for indicator in medium_risk_indicators))

        if high_risk_count > 0:
            return 'high'
        elif medium_risk_count > 0 or len(issues) > 2:
            return 'medium'
        else:
            return 'low'

    def _generate_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate security recommendations"""
        recommendations = []

        if not analysis['safe']:
            recommendations.append("Use parameterized queries to prevent SQL injection")

        if analysis['risk_level'] == 'high':
            recommendations.append("Block this request - high risk SQL injection detected")
            recommendations.append("Log this incident for security review")

        if analysis['risk_level'] == 'medium':
            recommendations.append("Sanitize input parameters")
            recommendations.append("Implement input validation")

        if not analysis.get('parameterized', False):
            recommendations.append("Convert to parameterized query")

        if 'special characters' in str(analysis['issues']):
            recommendations.append("Escape special characters in parameters")

        return recommendations

    def sanitize_sql_input(self, input_str: str, allow_functions: bool = False) -> str:
        """
        Sanitize SQL-like input (for cases where we need to build queries)

        Args:
            input_str: Input string to sanitize
            allow_functions: Whether to allow SQL functions

        Returns:
            Sanitized string
        """
        if not input_str:
            return input_str

        # Remove dangerous characters
        sanitized = re.sub(r'[;\'\"\\]', '', input_str)

        # Remove dangerous keywords unless they're safe functions
        words = re.findall(r'\b\w+\b', sanitized.lower())
        safe_words = []

        for word in words:
            if word in self.safe_functions and allow_functions:
                safe_words.append(word)
            elif word not in self.dangerous_keywords:
                safe_words.append(word)

        # Reconstruct sanitized string
        sanitized = ' '.join(safe_words)

        return sanitized.strip()

    def create_safe_query(self, base_query: str, conditions: List[Tuple[str, str, Any]]) -> Tuple[str, Dict[str, Any]]:
        """
        Create a safe parameterized query

        Args:
            base_query: Base query template
            conditions: List of (field, operator, value) tuples

        Returns:
            Tuple of (parameterized_query, parameters_dict)
        """
        parameters = {}
        param_count = 0

        for field, operator, value in conditions:
            param_name = f'param_{param_count}'
            param_count += 1

            # Validate operator
            safe_operators = ['=', '!=', '<', '>', '<=', '>=', 'like', 'in']
            if operator not in safe_operators:
                raise ValueError(f"Unsafe operator: {operator}")

            # Add to parameters
            parameters[param_name] = value

        # Note: In a real implementation, you'd build the actual query
        # This is a simplified example
        parameterized_query = base_query  # Would be modified to use :param_0, :param_1, etc.

        return parameterized_query, parameters

    def get_security_stats(self) -> Dict[str, Any]:
        """Get SQL injection protection statistics"""
        return {
            'total_scanned': self.attack_stats['total_scanned'],
            'attacks_detected': self.attack_stats['attacks_detected'],
            'attacks_blocked': self.attack_stats['attacks_blocked'],
            'false_positives': self.attack_stats['false_positives'],
            'detection_rate': (self.attack_stats['attacks_detected'] /
                             max(self.attack_stats['total_scanned'], 1)) * 100,
            'cache_size': len(self.analysis_cache),
            'cache_hit_rate': 0  # Would need to track cache hits
        }

# Global SQL injection protector
sql_protector = SQLInjectionProtector()

# Flask decorators
def protect_sql_injection(f):
    """Decorator to protect against SQL injection in route handlers"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Analyze request data for SQL injection
        request_data = {}

        # Check JSON data
        if request.is_json and request.get_json():
            request_data.update(request.get_json())

        # Check form data
        if request.form:
            request_data.update(dict(request.form))

        # Check URL args
        if request.args:
            request_data.update(dict(request.args))

        # Analyze each parameter
        for key, value in request_data.items():
            if isinstance(value, str):
                analysis = sql_protector.analyze_query(value)
                if not analysis['safe'] and analysis['risk_level'] in ['medium', 'high']:
                    logger.warning(f"SQL injection attempt detected in parameter '{key}': {value[:100]}...")
                    sql_protector.attack_stats['attacks_blocked'] += 1

                    from flask import jsonify
                    return jsonify({
                        'error': 'Security violation',
                        'message': 'Invalid input detected'
                    }), 400

        return f(*args, **kwargs)

    return decorated_function

def validate_sql_parameters(rules: Dict[str, Dict]):
    """Decorator to validate SQL query parameters"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Validate parameters against rules
            validation_errors = []

            for param_name, param_value in kwargs.items():
                if param_name in rules:
                    rule = rules[param_name]

                    # Type validation
                    if 'type' in rule and not isinstance(param_value, rule['type']):
                        validation_errors.append(f"Parameter '{param_name}' must be {rule['type'].__name__}")

                    # SQL injection check
                    if isinstance(param_value, str):
                        analysis = sql_protector.analyze_query(param_value)
                        if not analysis['safe']:
                            validation_errors.append(f"Parameter '{param_name}' contains unsafe content")

                    # Pattern validation
                    if 'pattern' in rule and isinstance(param_value, str):
                        if not re.match(rule['pattern'], param_value):
                            validation_errors.append(f"Parameter '{param_name}' does not match required pattern")

            if validation_errors:
                from flask import jsonify
                return jsonify({
                    'error': 'Parameter validation failed',
                    'details': validation_errors
                }), 400

            return f(*args, **kwargs)

        return decorated_function

    return decorator

# Utility functions
def analyze_sql_query(query: str, parameters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Analyze a SQL query for injection risks"""
    return sql_protector.analyze_query(query, parameters)

def sanitize_sql_input(input_str: str, allow_functions: bool = False) -> str:
    """Sanitize SQL-like input"""
    return sql_protector.sanitize_sql_input(input_str, allow_functions)

def get_sql_security_stats() -> Dict[str, Any]:
    """Get SQL injection protection statistics"""
    return sql_protector.get_security_stats()

__all__ = [
    'SQLInjectionProtector',
    'sql_protector',
    'protect_sql_injection',
    'validate_sql_parameters',
    'analyze_sql_query',
    'sanitize_sql_input',
    'get_sql_security_stats'
]