#!/usr/bin/env python3
"""
Performance Testing Script for Lugn & Trygg
Comprehensive performance benchmarking and stress testing
"""

import os
import sys
import time
import json
import asyncio
import aiohttp
import statistics
from typing import Dict, List, Any, Tuple
from concurrent.futures import ThreadPoolExecutor
import psutil
import threading

# Add Backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'Backend'))

class PerformanceTester:
    """Performance testing framework"""

    def __init__(self, base_url: str = "http://localhost:5001", concurrent_users: int = 100):
        self.base_url = base_url
        self.concurrent_users = concurrent_users
        self.results: Dict[str, Any] = {}
        self.system_metrics: List[Dict[str, Any]] = []

    async def make_request(self, session: aiohttp.ClientSession, endpoint: str,
                          method: str = 'GET', data: Dict = None) -> Tuple[float, int, bool]:
        """Make a single HTTP request and measure response time"""
        start_time = time.time()

        try:
            url = f"{self.base_url}{endpoint}"

            if method == 'GET':
                async with session.get(url) as response:
                    await response.text()
                    response_time = time.time() - start_time
                    return response_time, response.status, True

            elif method == 'POST' and data:
                async with session.post(url, json=data) as response:
                    await response.text()
                    response_time = time.time() - start_time
                    return response_time, response.status, True

        except Exception as e:
            response_time = time.time() - start_time
            return response_time, 0, False

        return time.time() - start_time, 0, False

    async def simulate_user_journey(self, session: aiohttp.ClientSession, user_id: int) -> List[Tuple[float, int, bool]]:
        """Simulate a complete user journey"""
        results = []

        # 1. Health check
        result = await self.make_request(session, '/api/health')
        results.append(result)

        # 2. Login (if implemented)
        login_data = {
            'email': f'user{user_id}@example.com',
            'password': 'testpassword123'
        }
        result = await self.make_request(session, '/api/auth/login', 'POST', login_data)
        results.append(result)

        # 3. Get user data
        result = await self.make_request(session, '/api/dashboard/stats')
        results.append(result)

        # 4. Log mood
        mood_data = {
            'mood_score': 7,
            'notes': f'Performance test mood from user {user_id}',
            'activities': ['work', 'test']
        }
        result = await self.make_request(session, '/api/mood/log', 'POST', mood_data)
        results.append(result)

        # 5. Get mood history
        result = await self.make_request(session, '/api/mood/list')
        results.append(result)

        return results

    def monitor_system_resources(self):
        """Monitor system resources during test"""
        while self.monitoring_active:
            metrics = {
                'timestamp': time.time(),
                'cpu_percent': psutil.cpu_percent(interval=1),
                'memory_percent': psutil.virtual_memory().percent,
                'memory_used': psutil.virtual_memory().used,
                'disk_io': psutil.disk_io_counters().read_bytes + psutil.disk_io_counters().write_bytes if psutil.disk_io_counters() else 0,
                'network_io': psutil.net_io_counters().bytes_sent + psutil.net_io_counters().bytes_recv if psutil.net_io_counters() else 0
            }
            self.system_metrics.append(metrics)
            time.sleep(1)

    async def run_load_test(self, duration: int = 60) -> Dict[str, Any]:
        """Run comprehensive load test"""
        print(f"⚡ Running load test with {self.concurrent_users} concurrent users for {duration}s...")

        # Start system monitoring
        self.monitoring_active = True
        monitor_thread = threading.Thread(target=self.monitor_system_resources)
        monitor_thread.start()

        start_time = time.time()
        all_results = []

        async with aiohttp.ClientSession() as session:
            tasks = []

            # Create tasks for concurrent users
            for user_id in range(self.concurrent_users):
                task = self.simulate_user_journey(session, user_id)
                tasks.append(task)

            # Run all tasks concurrently
            journey_results = await asyncio.gather(*tasks, return_exceptions=True)

            # Flatten results
            for journey_result in journey_results:
                if isinstance(journey_result, Exception):
                    print(f"❌ Journey failed: {journey_result}")
                    continue

                for result in journey_result:
                    all_results.append(result)

        # Stop monitoring
        self.monitoring_active = False
        monitor_thread.join()

        end_time = time.time()
        actual_duration = end_time - start_time

        # Analyze results
        successful_requests = [r for r in all_results if r[2]]  # Only successful requests
        failed_requests = [r for r in all_results if not r[2]]

        if successful_requests:
            response_times = [r[0] for r in successful_requests]
            avg_response_time = statistics.mean(response_times)
            median_response_time = statistics.median(response_times)
            p95_response_time = statistics.quantiles(response_times, n=20)[18]  # 95th percentile
            min_response_time = min(response_times)
            max_response_time = max(response_times)

            requests_per_second = len(successful_requests) / actual_duration
        else:
            avg_response_time = median_response_time = p95_response_time = 0
            min_response_time = max_response_time = 0
            requests_per_second = 0

        error_rate = len(failed_requests) / len(all_results) if all_results else 0

        # Analyze system metrics
        if self.system_metrics:
            avg_cpu = statistics.mean([m['cpu_percent'] for m in self.system_metrics])
            avg_memory = statistics.mean([m['memory_percent'] for m in self.system_metrics])
            max_cpu = max([m['cpu_percent'] for m in self.system_metrics])
            max_memory = max([m['memory_percent'] for m in self.system_metrics])
        else:
            avg_cpu = avg_memory = max_cpu = max_memory = 0

        results = {
            'test_duration': actual_duration,
            'concurrent_users': self.concurrent_users,
            'total_requests': len(all_results),
            'successful_requests': len(successful_requests),
            'failed_requests': len(failed_requests),
            'requests_per_second': requests_per_second,
            'error_rate': error_rate,
            'response_times': {
                'average': avg_response_time,
                'median': median_response_time,
                'p95': p95_response_time,
                'min': min_response_time,
                'max': max_response_time
            },
            'system_metrics': {
                'avg_cpu_percent': avg_cpu,
                'max_cpu_percent': max_cpu,
                'avg_memory_percent': avg_memory,
                'max_memory_percent': max_memory
            }
        }

        return results

    def run_stress_test(self) -> Dict[str, Any]:
        """Run stress test with increasing load"""
        print("🔥 Running stress test with increasing load...")

        user_levels = [10, 50, 100, 200, 500, 1000]
        stress_results = {}

        for user_count in user_levels:
            print(f"  Testing with {user_count} users...")
            self.concurrent_users = user_count

            try:
                # Run test for 30 seconds per level
                results = asyncio.run(self.run_load_test(duration=30))
                stress_results[user_count] = results

                # Check if system is still responding
                if results['error_rate'] > 0.5:  # 50% error rate
                    print(f"  ❌ System failing at {user_count} users")
                    break
                else:
                    print(".2f"            except Exception as e:
                print(f"  ❌ Stress test failed at {user_count} users: {e}")
                break

        return stress_results

    def run_database_performance_test(self) -> Dict[str, Any]:
        """Test database query performance"""
        print("🗃️  Testing database performance...")

        try:
            from src.firebase_config import db

            # Test Firestore query performance
            start_time = time.time()

            # Query moods collection (simulate real usage)
            moods_ref = db.collection('moods')
            query = moods_ref.limit(100)  # Get first 100 moods
            docs = query.stream()

            query_time = time.time() - start_time
            doc_count = len(list(docs))

            # Test write performance
            start_time = time.time()

            # Simulate mood logging
            test_mood = {
                'user_id': 'perf_test_user',
                'mood_score': 8,
                'notes': 'Performance test entry',
                'timestamp': time.time(),
                'activities': ['performance_test']
            }

            doc_ref = db.collection('moods').document()
            doc_ref.set(test_mood)

            write_time = time.time() - start_time

            # Clean up test data
            doc_ref.delete()

            return {
                'query_time': query_time,
                'documents_retrieved': doc_count,
                'write_time': write_time,
                'queries_per_second': 1 / query_time if query_time > 0 else 0,
                'writes_per_second': 1 / write_time if write_time > 0 else 0
            }

        except Exception as e:
            print(f"❌ Database performance test failed: {e}")
            return {'error': str(e)}

    def assess_performance(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Assess performance against benchmarks"""
        assessment = {
            'overall_score': 'UNKNOWN',
            'issues': [],
            'recommendations': []
        }

        # Response time benchmarks
        if results.get('response_times', {}).get('p95', 0) > 2.0:  # 2 seconds
            assessment['issues'].append('95th percentile response time too high (>2s)')
            assessment['recommendations'].append('Implement caching and optimize database queries')

        if results.get('response_times', {}).get('average', 0) > 1.0:  # 1 second
            assessment['issues'].append('Average response time too high (>1s)')
            assessment['recommendations'].append('Add database indexes and implement Redis caching')

        # Error rate benchmark
        if results.get('error_rate', 0) > 0.05:  # 5%
            assessment['issues'].append('Error rate too high (>5%)')
            assessment['recommendations'].append('Fix application errors and improve error handling')

        # Throughput benchmark
        if results.get('requests_per_second', 0) < 50:
            assessment['issues'].append('Throughput too low (<50 req/sec)')
            assessment['recommendations'].append('Scale application servers and optimize code')

        # System resource benchmarks
        if results.get('system_metrics', {}).get('max_cpu_percent', 0) > 80:
            assessment['issues'].append('High CPU usage (>80%)')
            assessment['recommendations'].append('Optimize CPU-intensive operations')

        if results.get('system_metrics', {}).get('max_memory_percent', 0) > 85:
            assessment['issues'].append('High memory usage (>85%)')
            assessment['recommendations'].append('Fix memory leaks and optimize memory usage')

        # Overall score
        issue_count = len(assessment['issues'])
        if issue_count == 0:
            assessment['overall_score'] = 'EXCELLENT'
        elif issue_count <= 2:
            assessment['overall_score'] = 'GOOD'
        elif issue_count <= 4:
            assessment['overall_score'] = 'FAIR'
        else:
            assessment['overall_score'] = 'POOR'

        return assessment

    def print_report(self, results: Dict[str, Any], assessment: Dict[str, Any]):
        """Print comprehensive performance report"""
        print("\n" + "=" * 70)
        print("📊 PERFORMANCE TEST REPORT")
        print("=" * 70)

        print(f"Test Duration: {results.get('test_duration', 0):.2f}s")
        print(f"Concurrent Users: {results.get('concurrent_users', 0)}")
        print(f"Total Requests: {results.get('total_requests', 0)}")
        print(f"Successful Requests: {results.get('successful_requests', 0)}")
        print(f"Failed Requests: {results.get('failed_requests', 0)}")
        print(f"Requests/sec: {results.get('requests_per_second', 0):.2f}")
        print(f"Error Rate: {results.get('error_rate', 0)*100:.2f}%")

        rt = results.get('response_times', {})
        print("
Response Times:")
        print(".2f"        print(".2f"        print(".2f"        print(".2f"        print(".2f"
        sm = results.get('system_metrics', {})
        print("
System Metrics:")
        print(".1f"        print(".1f"        print(".1f"        print(".1f"
        print(f"\n🎯 Overall Performance Score: {assessment['overall_score']}")

        if assessment['issues']:
            print("
⚠️  Performance Issues:")
            for issue in assessment['issues']:
                print(f"  • {issue}")

        if assessment['recommendations']:
            print("
💡 Recommendations:")
            for rec in assessment['recommendations']:
                print(f"  • {rec}")

        return assessment['overall_score'] in ['EXCELLENT', 'GOOD']

def main():
    """Main performance testing function"""
    print("⚡ Lugn & Trygg Performance Testing")
    print("=" * 45)

    # Initialize performance tester
    tester = PerformanceTester(concurrent_users=100)

    try:
        # Run load test
        print("\n🔥 Running Load Test...")
        load_results = asyncio.run(tester.run_load_test(duration=30))

        # Run database performance test
        print("\n🗃️  Running Database Performance Test...")
        db_results = tester.run_database_performance_test()

        # Assess performance
        assessment = tester.assess_performance(load_results)

        # Print comprehensive report
        success = tester.print_report(load_results, assessment)

        # Additional database metrics
        if 'error' not in db_results:
            print("
🗃️  Database Performance:")
            print(".3f"            print(f"  Documents Retrieved: {db_results.get('documents_retrieved', 0)}")
            print(".3f"            print(".1f"            print(".1f"
        if success:
            print("\n🎉 PERFORMANCE TESTS PASSED! System meets performance requirements.")
            return True
        else:
            print("\n❌ PERFORMANCE TESTS FAILED! Performance issues detected.")
            return False

    except Exception as e:
        print(f"❌ Performance testing failed: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)