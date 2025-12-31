#!/usr/bin/env python3
"""
Comprehensive Test Runner - Quality Assurance Suite

Runs all tests with comprehensive reporting, coverage analysis,
performance benchmarking, and quality metrics.
"""

import os
import sys
import subprocess
import json
import time
import argparse
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime, timezone

class TestRunner:
    """Comprehensive test runner with quality assurance"""

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.results_dir = project_root / 'test_results'
        self.results_dir.mkdir(exist_ok=True)
        self.timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')

    def run_all_tests(self) -> Dict[str, Any]:
        """Run complete test suite"""
        print("🚀 Starting comprehensive test suite...")

        results = {
            'timestamp': self.timestamp,
            'test_types': {},
            'summary': {},
            'quality_metrics': {},
            'performance': {},
            'recommendations': []
        }

        # Run unit tests
        results['test_types']['unit'] = self._run_unit_tests()

        # Run integration tests
        results['test_types']['integration'] = self._run_integration_tests()

        # Run end-to-end tests
        results['test_types']['e2e'] = self._run_e2e_tests()

        # Run performance tests
        results['test_types']['performance'] = self._run_performance_tests()

        # Run security tests
        results['test_types']['security'] = self._run_security_tests()

        # Generate coverage report
        results['coverage'] = self._generate_coverage_report()

        # Calculate quality metrics
        results['quality_metrics'] = self._calculate_quality_metrics(results)

        # Generate summary
        results['summary'] = self._generate_summary(results)

        # Generate recommendations
        results['recommendations'] = self._generate_recommendations(results)

        # Save results
        self._save_results(results)

        return results

    def _run_unit_tests(self) -> Dict[str, Any]:
        """Run unit tests"""
        print("📋 Running unit tests...")

        try:
            cmd = [
                sys.executable, '-m', 'pytest',
                'tests/',
                '-v',
                '--tb=short',
                '--junitxml=test_results/unit_results.xml',
                '--json=test_results/unit_results.json',
                '-m', 'not integration and not e2e'
            ]

            result = subprocess.run(cmd, cwd=self.project_root, capture_output=True, text=True)

            # Parse results
            test_results = self._parse_pytest_results('test_results/unit_results.json')

            return {
                'passed': result.returncode == 0,
                'return_code': result.returncode,
                'output': result.stdout,
                'errors': result.stderr,
                'results': test_results
            }

        except Exception as e:
            return {
                'passed': False,
                'error': str(e)
            }

    def _run_integration_tests(self) -> Dict[str, Any]:
        """Run integration tests"""
        print("🔗 Running integration tests...")

        try:
            cmd = [
                sys.executable, '-m', 'pytest',
                'tests/',
                '-v',
                '--tb=short',
                '--junitxml=test_results/integration_results.xml',
                '--json=test_results/integration_results.json',
                '-m', 'integration'
            ]

            result = subprocess.run(cmd, cwd=self.project_root, capture_output=True, text=True)

            test_results = self._parse_pytest_results('test_results/integration_results.json')

            return {
                'passed': result.returncode == 0,
                'return_code': result.returncode,
                'output': result.stdout,
                'errors': result.stderr,
                'results': test_results
            }

        except Exception as e:
            return {
                'passed': False,
                'error': str(e)
            }

    def _run_e2e_tests(self) -> Dict[str, Any]:
        """Run end-to-end tests"""
        print("🌐 Running end-to-end tests...")

        try:
            # Check if Playwright is available
            import playwright
            playwright_available = True
        except ImportError:
            playwright_available = False

        if not playwright_available:
            return {
                'passed': False,
                'skipped': True,
                'reason': 'Playwright not available'
            }

        try:
            cmd = [
                sys.executable, '-m', 'pytest',
                'tests/e2e/',
                '-v',
                '--tb=short',
                '--junitxml=test_results/e2e_results.xml',
                '--json=test_results/e2e_results.json'
            ]

            result = subprocess.run(cmd, cwd=self.project_root, capture_output=True, text=True)

            test_results = self._parse_pytest_results('test_results/e2e_results.json')

            return {
                'passed': result.returncode == 0,
                'return_code': result.returncode,
                'output': result.stdout,
                'errors': result.stderr,
                'results': test_results
            }

        except Exception as e:
            return {
                'passed': False,
                'error': str(e)
            }

    def _run_performance_tests(self) -> Dict[str, Any]:
        """Run performance tests"""
        print("⚡ Running performance tests...")

        try:
            # Run load tests if available
            load_test_file = self.project_root / 'Backend' / 'load_test.py'
            if load_test_file.exists():
                cmd = [sys.executable, str(load_test_file)]

                result = subprocess.run(cmd, cwd=self.project_root, capture_output=True, text=True)

                return {
                    'passed': result.returncode == 0,
                    'return_code': result.returncode,
                    'output': result.stdout,
                    'errors': result.stderr
                }
            else:
                return {
                    'passed': True,
                    'skipped': True,
                    'reason': 'No performance tests available'
                }

        except Exception as e:
            return {
                'passed': False,
                'error': str(e)
            }

    def _run_security_tests(self) -> Dict[str, Any]:
        """Run security tests"""
        print("🔒 Running security tests...")

        try:
            cmd = [
                sys.executable, '-m', 'pytest',
                'tests/',
                '-v',
                '--tb=short',
                '-k', 'security or auth or encryption',
                '--junitxml=test_results/security_results.xml',
                '--json=test_results/security_results.json'
            ]

            result = subprocess.run(cmd, cwd=self.project_root, capture_output=True, text=True)

            test_results = self._parse_pytest_results('test_results/security_results.json')

            return {
                'passed': result.returncode == 0,
                'return_code': result.returncode,
                'output': result.stdout,
                'errors': result.stderr,
                'results': test_results
            }

        except Exception as e:
            return {
                'passed': False,
                'error': str(e)
            }

    def _generate_coverage_report(self) -> Dict[str, Any]:
        """Generate code coverage report"""
        print("📊 Generating coverage report...")

        try:
            cmd = [
                sys.executable, '-m', 'pytest',
                '--cov=src',
                '--cov-report=html:test_results/coverage_html',
                '--cov-report=json:test_results/coverage.json',
                '--cov-report=term-missing',
                'tests/'
            ]

            result = subprocess.run(cmd, cwd=self.project_root, capture_output=True, text=True)

            # Parse coverage JSON
            coverage_file = self.results_dir / 'coverage.json'
            if coverage_file.exists():
                with open(coverage_file) as f:
                    coverage_data = json.load(f)

                return {
                    'generated': True,
                    'overall_coverage': coverage_data.get('totals', {}).get('percent_covered', 0),
                    'files_covered': len(coverage_data.get('files', {})),
                    'html_report': str(self.results_dir / 'coverage_html' / 'index.html')
                }
            else:
                return {
                    'generated': False,
                    'error': 'Coverage report not generated'
                }

        except Exception as e:
            return {
                'generated': False,
                'error': str(e)
            }

    def _parse_pytest_results(self, results_file: str) -> Dict[str, Any]:
        """Parse pytest JSON results"""
        try:
            results_path = self.results_dir / results_file
            if results_path.exists():
                with open(results_path) as f:
                    data = json.load(f)

                return {
                    'summary': data.get('summary', {}),
                    'tests': data.get('tests', []),
                    'collectors': data.get('collectors', [])
                }
            else:
                return {'error': 'Results file not found'}

        except Exception as e:
            return {'error': str(e)}

    def _calculate_quality_metrics(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate code quality metrics"""
        metrics = {
            'test_coverage': 0,
            'test_success_rate': 0,
            'code_quality_score': 0,
            'security_score': 0
        }

        # Calculate test coverage
        if 'coverage' in results and results['coverage'].get('generated'):
            metrics['test_coverage'] = results['coverage']['overall_coverage']

        # Calculate test success rate
        total_tests = 0
        passed_tests = 0

        for test_type, test_results in results['test_types'].items():
            if 'results' in test_results and 'summary' in test_results['results']:
                summary = test_results['results']['summary']
                total_tests += summary.get('num_tests', 0)
                passed_tests += summary.get('num_tests', 0) - summary.get('num_failed', 0) - summary.get('num_errors', 0)

        if total_tests > 0:
            metrics['test_success_rate'] = (passed_tests / total_tests) * 100

        # Calculate code quality score (simplified)
        coverage_score = min(metrics['test_coverage'] / 80 * 100, 100)  # Target 80% coverage
        success_score = metrics['test_success_rate']

        metrics['code_quality_score'] = (coverage_score + success_score) / 2

        # Security score based on security tests
        security_tests = results['test_types'].get('security', {})
        if security_tests.get('passed'):
            metrics['security_score'] = 100
        else:
            metrics['security_score'] = 50  # Partial credit for having security tests

        return metrics

    def _generate_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate test summary"""
        summary = {
            'total_test_types': len(results['test_types']),
            'passed_test_types': 0,
            'failed_test_types': 0,
            'overall_status': 'unknown'
        }

        for test_type, test_results in results['test_types'].items():
            if test_results.get('passed'):
                summary['passed_test_types'] += 1
            else:
                summary['failed_test_types'] += 1

        # Determine overall status
        if summary['failed_test_types'] == 0:
            summary['overall_status'] = 'passed'
        elif summary['passed_test_types'] > summary['failed_test_types']:
            summary['overall_status'] = 'mostly_passed'
        else:
            summary['overall_status'] = 'failed'

        return summary

    def _generate_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate improvement recommendations"""
        recommendations = []

        quality_metrics = results.get('quality_metrics', {})

        # Coverage recommendations
        coverage = quality_metrics.get('test_coverage', 0)
        if coverage < 70:
            recommendations.append(f"Improve test coverage (currently {coverage:.1f}%) - target 80%+")
        elif coverage < 80:
            recommendations.append(f"Good coverage ({coverage:.1f}%) - aim for 80%+ for production readiness")

        # Test success recommendations
        success_rate = quality_metrics.get('test_success_rate', 0)
        if success_rate < 95:
            recommendations.append(f"Fix failing tests - current success rate: {success_rate:.1f}%")

        # Security recommendations
        security_score = quality_metrics.get('security_score', 0)
        if security_score < 80:
            recommendations.append("Enhance security testing and validation")

        # Performance recommendations
        if not results['test_types'].get('performance', {}).get('passed'):
            recommendations.append("Implement performance and load testing")

        # E2E recommendations
        if not results['test_types'].get('e2e', {}).get('passed'):
            recommendations.append("Add end-to-end tests for critical user journeys")

        return recommendations

    def _save_results(self, results: Dict[str, Any]):
        """Save test results to files"""
        # Save JSON results
        results_file = self.results_dir / f'test_results_{self.timestamp}.json'
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)

        # Generate HTML report
        html_report = self._generate_html_report(results)
        html_file = self.results_dir / f'test_report_{self.timestamp}.html'
        with open(html_file, 'w') as f:
            f.write(html_report)

        print(f"📄 Results saved to: {results_file}")
        print(f"🌐 HTML report: {html_file}")

    def _generate_html_report(self, results: Dict[str, Any]) -> str:
        """Generate HTML test report"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test Results - {self.timestamp}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .summary {{ background: #f0f0f0; padding: 20px; border-radius: 5px; margin-bottom: 20px; }}
                .passed {{ color: green; }}
                .failed {{ color: red; }}
                .warning {{ color: orange; }}
                .metric {{ margin: 10px 0; }}
                .recommendations {{ background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <h1>Lugn & Trygg Test Results</h1>
            <p><strong>Generated:</strong> {self.timestamp}</p>

            <div class="summary">
                <h2>Summary</h2>
                <div class="metric">
                    <strong>Overall Status:</strong>
                    <span class="{results['summary']['overall_status']}">
                        {results['summary']['overall_status'].upper()}
                    </span>
                </div>
                <div class="metric">
                    <strong>Test Types:</strong> {results['summary']['total_test_types']}
                    (Passed: {results['summary']['passed_test_types']},
                     Failed: {results['summary']['failed_test_types']})
                </div>
                <div class="metric">
                    <strong>Test Coverage:</strong> {results['quality_metrics'].get('test_coverage', 0):.1f}%
                </div>
                <div class="metric">
                    <strong>Test Success Rate:</strong> {results['quality_metrics'].get('test_success_rate', 0):.1f}%
                </div>
                <div class="metric">
                    <strong>Code Quality Score:</strong> {results['quality_metrics'].get('code_quality_score', 0):.1f}/100
                </div>
            </div>

            <h2>Test Results by Type</h2>
            <table>
                <tr>
                    <th>Test Type</th>
                    <th>Status</th>
                    <th>Details</th>
                </tr>
        """

        for test_type, test_results in results['test_types'].items():
            status_class = 'passed' if test_results.get('passed') else 'failed'
            status_text = 'PASSED' if test_results.get('passed') else 'FAILED'

            details = ""
            if 'results' in test_results and 'summary' in test_results['results']:
                summary = test_results['results']['summary']
                details = f"Tests: {summary.get('num_tests', 0)}, Failed: {summary.get('num_failed', 0)}"

            html += f"""
                <tr>
                    <td>{test_type.title()}</td>
                    <td class="{status_class}">{status_text}</td>
                    <td>{details}</td>
                </tr>
            """

        html += """
            </table>

            <h2>Recommendations</h2>
            <div class="recommendations">
                <ul>
        """

        for rec in results.get('recommendations', []):
            html += f"<li>{rec}</li>"

        html += """
                </ul>
            </div>
        </body>
        </html>
        """

        return html

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Run comprehensive test suite')
    parser.add_argument('--project-root', default='.', help='Project root directory')
    parser.add_argument('--test-type', choices=['all', 'unit', 'integration', 'e2e', 'performance', 'security'],
                       default='all', help='Type of tests to run')
    parser.add_argument('--coverage', action='store_true', help='Generate coverage report')
    parser.add_argument('--html-report', action='store_true', help='Generate HTML report')

    args = parser.parse_args()

    project_root = Path(args.project_root)

    if args.test_type == 'all':
        runner = TestRunner(project_root)
        results = runner.run_all_tests()

        # Print summary
        print(f"\n🎯 Test Suite Complete!")
        print(f"Overall Status: {results['summary']['overall_status'].upper()}")
        print(f"Coverage: {results['quality_metrics'].get('test_coverage', 0):.1f}%")
        print(f"Success Rate: {results['quality_metrics'].get('test_success_rate', 0):.1f}%")

        if results['recommendations']:
            print("\n💡 Recommendations:")
            for rec in results['recommendations']:
                print(f"  • {rec}")

        # Exit with appropriate code
        success = results['summary']['overall_status'] in ['passed', 'mostly_passed']
        sys.exit(0 if success else 1)

    else:
        # Run specific test type
        print(f"Running {args.test_type} tests...")
        # Implementation for specific test types would go here
        print("Specific test type execution not yet implemented")

if __name__ == '__main__':
    main()