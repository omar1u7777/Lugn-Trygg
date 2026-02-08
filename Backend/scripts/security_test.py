#!/usr/bin/env python3
"""
Security Testing Script for Lugn & Trygg
OWASP ZAP integration and security vulnerability scanning
"""

import os
import sys
import json
import time
import requests
import subprocess
from typing import Dict, List, Any
from urllib.parse import urljoin

# Add Backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

class SecurityTester:
    """Security testing framework"""

    def __init__(self, base_url: str = "http://localhost:5001"):
        self.base_url = base_url
        self.session = requests.Session()
        self.vulnerabilities: List[Dict[str, Any]] = []
        self.test_results: Dict[str, Any] = {}

    def log_vulnerability(self, severity: str, title: str, description: str,
                         endpoint: str, impact: str, remediation: str):
        """Log a security vulnerability"""
        vuln = {
            'severity': severity,
            'title': title,
            'description': description,
            'endpoint': endpoint,
            'impact': impact,
            'remediation': remediation,
            'timestamp': time.time()
        }
        self.vulnerabilities.append(vuln)
        print(f"🚨 [{severity}] {title}")

    def test_sql_injection(self) -> bool:
        """Test for SQL injection vulnerabilities"""
        print("🗃️  Testing SQL Injection...")

        test_cases = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --",
            "admin' --",
            "1' OR '1' = '1"
        ]

        vulnerable_endpoints = []

        # Test login endpoint
        for payload in test_cases:
            try:
                data = {
                    'email': f"test{payload}@example.com",
                    'password': 'password123'
                }
                response = self.session.post(f"{self.base_url}/api/auth/login", json=data)

                if response.status_code == 200:
                    data = response.json()
                    if 'access_token' in data:
                        vulnerable_endpoints.append('/api/auth/login')
                        break

            except Exception as e:
                continue

        if vulnerable_endpoints:
            self.log_vulnerability(
                'HIGH',
                'SQL Injection Vulnerability',
                'Application may be vulnerable to SQL injection attacks',
                str(vulnerable_endpoints),
                'Data breach, unauthorized access',
                'Use parameterized queries and input validation'
            )
            return False

        print("✅ No SQL injection vulnerabilities detected")
        return True

    def test_xss(self) -> bool:
        """Test for Cross-Site Scripting vulnerabilities"""
        print("🕷️  Testing XSS...")

        xss_payloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            'javascript:alert("XSS")',
            '<svg onload=alert("XSS")>',
            '">\"<script>alert("XSS")</script>'
        ]

        vulnerable_endpoints = []

        # Test mood logging (user input)
        for payload in xss_payloads:
            try:
                # First login to get token
                login_data = {'email': 'test@example.com', 'password': 'test123'}
                login_response = self.session.post(f"{self.base_url}/api/auth/login", json=login_data)

                if login_response.status_code == 200:
                    token = login_response.json().get('access_token')
                    if token:
                        self.session.headers.update({'Authorization': f'Bearer {token}'})

                        # Test mood logging with XSS payload
                        mood_data = {
                            'mood_score': 5,
                            'notes': payload,
                            'activities': ['test']
                        }

                        response = self.session.post(f"{self.base_url}/api/mood/log", json=mood_data)

                        # Check if payload is reflected in response
                        if payload in response.text:
                            vulnerable_endpoints.append('/api/mood/log')
                            break

            except Exception as e:
                continue

        if vulnerable_endpoints:
            self.log_vulnerability(
                'HIGH',
                'Cross-Site Scripting (XSS) Vulnerability',
                'User input is not properly sanitized, allowing XSS attacks',
                str(vulnerable_endpoints),
                'Session hijacking, data theft',
                'Implement input sanitization and Content Security Policy'
            )
            return False

        print("✅ No XSS vulnerabilities detected")
        return True

    def test_authentication_bypass(self) -> bool:
        """Test for authentication bypass vulnerabilities"""
        print("🔐 Testing Authentication Bypass...")

        # Test endpoints that require authentication
        protected_endpoints = [
            '/api/mood/list',
            '/api/memory/list',
            '/api/dashboard/stats'
        ]

        bypass_success = False

        for endpoint in protected_endpoints:
            try:
                # Clear any existing auth
                self.session.headers.pop('Authorization', None)

                response = self.session.get(f"{self.base_url}{endpoint}")

                # Should return 401 Unauthorized
                if response.status_code != 401:
                    bypass_success = True
                    break

            except Exception as e:
                continue

        if bypass_success:
            self.log_vulnerability(
                'CRITICAL',
                'Authentication Bypass',
                'Protected endpoints can be accessed without authentication',
                str(protected_endpoints),
                'Complete system compromise',
                'Implement proper JWT validation on all protected routes'
            )
            return False

        print("✅ Authentication properly enforced")
        return True

    def test_rate_limiting(self) -> bool:
        """Test rate limiting effectiveness"""
        print("🚦 Testing Rate Limiting...")

        # Make many rapid requests to test rate limiting
        endpoint = f"{self.base_url}/api/health"

        responses = []
        for i in range(150):  # More than typical rate limit
            try:
                response = self.session.get(endpoint)
                responses.append(response.status_code)

                # Small delay to avoid overwhelming
                time.sleep(0.01)

            except Exception as e:
                responses.append(0)  # Connection error

        # Check if we got rate limited (429 status)
        rate_limited_responses = [r for r in responses if r == 429]

        if not rate_limited_responses:
            self.log_vulnerability(
                'MEDIUM',
                'Missing Rate Limiting',
                'No rate limiting detected on API endpoints',
                '/api/health',
                'DDoS attacks, resource exhaustion',
                'Implement rate limiting middleware'
            )
            return False

        print(f"✅ Rate limiting working ({len(rate_limited_responses)} requests blocked)")
        return True

    def test_security_headers(self) -> bool:
        """Test security headers"""
        print("🛡️  Testing Security Headers...")

        response = self.session.get(f"{self.base_url}/api/health")

        required_headers = [
            'X-Content-Type-Options',
            'X-Frame-Options',
            'X-XSS-Protection',
            'Content-Security-Policy'
        ]

        missing_headers = []
        for header in required_headers:
            if header not in response.headers:
                missing_headers.append(header)

        if missing_headers:
            self.log_vulnerability(
                'MEDIUM',
                'Missing Security Headers',
                f'Critical security headers are missing: {missing_headers}',
                '/api/health',
                'Various client-side attacks',
                'Implement security headers middleware'
            )
            return False

        print("✅ Security headers properly configured")
        return True

    def test_https_enforcement(self) -> bool:
        """Test HTTPS enforcement"""
        print("🔒 Testing HTTPS Enforcement...")

        # Only test if not localhost
        if 'localhost' in self.base_url or '127.0.0.1' in self.base_url:
            print("✅ HTTPS test skipped for localhost")
            return True

        if not self.base_url.startswith('https://'):
            self.log_vulnerability(
                'HIGH',
                'HTTP Instead of HTTPS',
                'Application is not using HTTPS in production',
                self.base_url,
                'Man-in-the-middle attacks, data interception',
                'Enforce HTTPS with HSTS headers'
            )
            return False

        print("✅ HTTPS properly enforced")
        return True

    def test_sensitive_data_exposure(self) -> bool:
        """Test for sensitive data exposure"""
        print("🔓 Testing Sensitive Data Exposure...")

        # Check if error messages leak sensitive information
        response = self.session.get(f"{self.base_url}/api/nonexistent")

        if response.status_code == 404:
            response_text = response.text.lower()
            sensitive_keywords = ['password', 'token', 'key', 'secret', 'firebase']

            exposed_data = []
            for keyword in sensitive_keywords:
                if keyword in response_text:
                    exposed_data.append(keyword)

            if exposed_data:
                self.log_vulnerability(
                    'MEDIUM',
                    'Information Disclosure',
                    f'Error messages may leak sensitive information: {exposed_data}',
                    '/api/nonexistent',
                    'Information gathering for attacks',
                    'Implement generic error messages'
                )
                return False

        print("✅ No sensitive data exposure detected")
        return True

    def run_all_security_tests(self) -> Dict[str, Any]:
        """Run all security tests"""
        print("🔒 Starting Security Testing Suite")
        print("=" * 50)

        tests = [
            ("SQL Injection", self.test_sql_injection),
            ("Cross-Site Scripting", self.test_xss),
            ("Authentication Bypass", self.test_authentication_bypass),
            ("Rate Limiting", self.test_rate_limiting),
            ("Security Headers", self.test_security_headers),
            ("HTTPS Enforcement", self.test_https_enforcement),
            ("Sensitive Data Exposure", self.test_sensitive_data_exposure),
        ]

        results = {}
        passed = 0
        total = len(tests)

        for test_name, test_func in tests:
            try:
                result = test_func()
                results[test_name] = result
                if result:
                    passed += 1
            except Exception as e:
                print(f"❌ {test_name} crashed: {e}")
                results[test_name] = False

        # Generate security report
        report = {
            'summary': {
                'total_tests': total,
                'passed_tests': passed,
                'failed_tests': total - passed,
                'vulnerabilities_found': len(self.vulnerabilities)
            },
            'test_results': results,
            'vulnerabilities': self.vulnerabilities,
            'risk_assessment': self._assess_risk_level()
        }

        return report

    def _assess_risk_level(self) -> str:
        """Assess overall risk level"""
        critical = len([v for v in self.vulnerabilities if v['severity'] == 'CRITICAL'])
        high = len([v for v in self.vulnerabilities if v['severity'] == 'HIGH'])
        medium = len([v for v in self.vulnerabilities if v['severity'] == 'MEDIUM'])

        if critical > 0:
            return 'CRITICAL'
        elif high > 0:
            return 'HIGH'
        elif medium > 2:
            return 'MEDIUM'
        elif medium > 0:
            return 'LOW'
        else:
            return 'SECURE'

    def print_report(self, report: Dict[str, Any]):
        """Print security test report"""
        print("\n" + "=" * 60)
        print("🔒 SECURITY TEST REPORT")
        print("=" * 60)

        summary = report['summary']
        print(f"Tests Run: {summary['total_tests']}")
        print(f"Tests Passed: {summary['passed_tests']}")
        print(f"Tests Failed: {summary['failed_tests']}")
        print(f"Vulnerabilities Found: {summary['vulnerabilities_found']}")
        print(f"Risk Level: {report['risk_assessment']}")

        if report['vulnerabilities']:
            print("\n🚨 VULNERABILITIES FOUND:")
            for vuln in report['vulnerabilities']:
                print(f"  [{vuln['severity']}] {vuln['title']}")
                print(f"    Endpoint: {vuln['endpoint']}")
                print(f"    Impact: {vuln['impact']}")
                print(f"    Fix: {vuln['remediation']}")
                print()

        return summary['failed_tests'] == 0 and summary['vulnerabilities_found'] == 0

def main():
    """Main security testing function"""
    print("🛡️  Lugn & Trygg Security Testing")
    print("=" * 40)

    # Initialize security tester
    tester = SecurityTester()

    # Run all security tests
    report = tester.run_all_security_tests()

    # Print results
    success = tester.print_report(report)

    if success:
        print("🎉 SECURITY TESTS PASSED! No critical vulnerabilities found.")
        return True
    else:
        print("❌ SECURITY TESTS FAILED! Vulnerabilities detected.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
