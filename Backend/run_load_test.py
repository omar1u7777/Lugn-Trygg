"""
Load Test Execution Script for Lugn & Trygg
Run this to simulate 1000 concurrent users and validate production readiness
"""

import os
import sys
import subprocess
import json
import time
from datetime import datetime
import psutil

def check_backend_health():
    """Check if backend is running and healthy."""
    try:
        import requests
        response = requests.get('http://localhost:5001/api/health', timeout=5)
        if response.status_code == 200:
            print("✓ Backend is healthy")
            return True
        else:
            print(f"❌ Backend returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend not accessible: {e}")
        return False

def check_system_resources():
    """Check if system has enough resources for load test."""
    cpu_count = psutil.cpu_count()
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    print(f"\n📊 System Resources:")
    print(f"   CPU Cores: {cpu_count}")
    print(f"   Memory: {memory.total / (1024**3):.1f} GB total, {memory.available / (1024**3):.1f} GB available ({memory.percent}% used)")
    print(f"   Disk: {disk.total / (1024**3):.1f} GB total, {disk.free / (1024**3):.1f} GB free ({disk.percent}% used)")
    
    warnings = []
    if memory.percent > 80:
        warnings.append("High memory usage - may affect load test")
    if cpu_count < 4:
        warnings.append(f"Only {cpu_count} CPU cores - recommend 4+ for 1000 users")
    if disk.percent > 90:
        warnings.append("Low disk space")
    
    if warnings:
        print(f"\n⚠️  Warnings:")
        for warning in warnings:
            print(f"   - {warning}")
        return False
    
    return True

def run_load_test(users=1000, spawn_rate=100, run_time='5m', headless=False):
    """
    Execute Locust load test.
    
    Args:
        users: Number of concurrent users
        spawn_rate: Users spawned per second
        run_time: Test duration (e.g., '5m', '1h')
        headless: Run without web UI
    """
    print(f"\n🚀 Starting Load Test")
    print(f"   Users: {users}")
    print(f"   Spawn Rate: {spawn_rate}/sec")
    print(f"   Duration: {run_time}")
    print(f"   Mode: {'Headless' if headless else 'Web UI'}")
    print()
    
    # Prepare command
    locust_file = os.path.join(os.path.dirname(__file__), 'load_test.py')
    
    cmd = [
        'locust',
        '-f', locust_file,
        '--host=http://localhost:5001',
        '--users', str(users),
        '--spawn-rate', str(spawn_rate),
    ]
    
    if headless:
        cmd.extend([
            '--headless',
            '--run-time', run_time,
            '--html', f'load_test_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.html',
            '--csv', f'load_test_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
        ])
        
        print("📝 Reports will be saved:")
        print(f"   HTML: load_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html")
        print(f"   CSV: load_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}_*.csv")
    else:
        print("🌐 Web UI will be available at: http://localhost:8089")
        print("   Open your browser and start the test manually")
    
    print()
    print("="*70)
    
    try:
        # Run Locust
        subprocess.run(cmd, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Load test failed: {e}")
        return False
    except KeyboardInterrupt:
        print(f"\n⚠️  Load test interrupted by user")
        return False

def analyze_results(csv_prefix):
    """Analyze load test results from CSV files."""
    import glob
    import pandas as pd
    
    stats_file = f"{csv_prefix}_stats.csv"
    failures_file = f"{csv_prefix}_failures.csv"
    
    if not os.path.exists(stats_file):
        print(f"❌ Stats file not found: {stats_file}")
        return
    
    print("\n📊 Load Test Results Analysis")
    print("="*70)
    
    # Read stats
    df_stats = pd.read_csv(stats_file)
    
    # Calculate metrics
    total_requests = df_stats['Request Count'].sum()
    total_failures = df_stats['Failure Count'].sum()
    error_rate = (total_failures / total_requests * 100) if total_requests > 0 else 0
    
    avg_response_time = df_stats['Average Response Time'].mean()
    p95_response_time = df_stats['95%'].mean()
    p99_response_time = df_stats['99%'].mean()
    
    throughput = df_stats['Requests/s'].sum()
    
    print(f"\n📈 Performance Metrics:")
    print(f"   Total Requests: {total_requests:,.0f}")
    print(f"   Failed Requests: {total_failures:,.0f}")
    print(f"   Error Rate: {error_rate:.2f}%")
    print(f"   Throughput: {throughput:.2f} req/sec")
    print()
    print(f"   Average Response Time: {avg_response_time:.0f} ms")
    print(f"   95th Percentile: {p95_response_time:.0f} ms")
    print(f"   99th Percentile: {p99_response_time:.0f} ms")
    
    # Performance targets
    print(f"\n🎯 Performance Targets:")
    targets = {
        'Error Rate': (error_rate, 1.0, '<'),
        '95th Percentile': (p95_response_time, 500, '<'),
        'Throughput': (throughput, 200, '>'),
    }
    
    all_passed = True
    for metric, (actual, target, comparison) in targets.items():
        if comparison == '<':
            passed = actual < target
            symbol = '<'
        else:
            passed = actual > target
            symbol = '>'
        
        status = '✓' if passed else '✗'
        color = '\033[92m' if passed else '\033[91m'
        reset = '\033[0m'
        
        print(f"   {status} {metric}: {actual:.2f} {symbol} {target} {color}{'PASS' if passed else 'FAIL'}{reset}")
        
        if not passed:
            all_passed = False
    
    # Read failures if any
    if os.path.exists(failures_file):
        df_failures = pd.read_csv(failures_file)
        if len(df_failures) > 0:
            print(f"\n❌ Failures Detected:")
            print(df_failures.to_string(index=False))
    
    print("\n" + "="*70)
    
    if all_passed:
        print("✅ PRODUCTION READY - All performance targets met!")
    else:
        print("⚠️  OPTIMIZATION NEEDED - Some targets not met")
        print("\nRecommendations:")
        if error_rate > 1.0:
            print("  - Investigate and fix errors in backend")
        if p95_response_time > 500:
            print("  - Optimize slow endpoints")
            print("  - Add database indexes")
            print("  - Implement caching")
        if throughput < 200:
            print("  - Increase Gunicorn workers")
            print("  - Add Redis for caching")
            print("  - Consider horizontal scaling")

def main():
    """Main execution function."""
    print("="*70)
    print("🧪 Lugn & Trygg Load Test Suite")
    print("="*70)
    
    # Check prerequisites
    print("\n🔍 Checking prerequisites...")
    
    if not check_backend_health():
        print("\n❌ Backend is not running or unhealthy")
        print("   Start backend: cd Backend && python main.py")
        sys.exit(1)
    
    if not check_system_resources():
        print("\n⚠️  System resources may be insufficient")
        response = input("   Continue anyway? (y/N): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    print("\n✅ Prerequisites met")
    
    # Test configuration
    print("\n📋 Load Test Configuration:")
    print("1. Quick Test (100 users, 2 minutes)")
    print("2. Standard Test (500 users, 5 minutes)")
    print("3. Full Test (1000 users, 10 minutes)")
    print("4. Stress Test (2000 users, 5 minutes)")
    print("5. Custom")
    
    choice = input("\nSelect test (1-5) [3]: ").strip() or '3'
    
    configs = {
        '1': (100, 50, '2m'),
        '2': (500, 100, '5m'),
        '3': (1000, 100, '10m'),
        '4': (2000, 200, '5m'),
    }
    
    if choice == '5':
        users = int(input("Number of users: "))
        spawn_rate = int(input("Spawn rate (users/sec): "))
        run_time = input("Duration (e.g., 5m, 1h): ")
    else:
        users, spawn_rate, run_time = configs.get(choice, configs['3'])
    
    # Run mode
    print("\n📊 Test Mode:")
    print("1. Web UI (interactive)")
    print("2. Headless (automated)")
    
    mode_choice = input("\nSelect mode (1-2) [2]: ").strip() or '2'
    headless = mode_choice == '2'
    
    # Confirm
    print("\n" + "="*70)
    print("⚠️  WARNING: This will generate significant load on your system")
    print("="*70)
    response = input("\nStart load test? (y/N): ")
    
    if response.lower() != 'y':
        print("Cancelled")
        sys.exit(0)
    
    # Execute test
    success = run_load_test(users, spawn_rate, run_time, headless)
    
    if success and headless:
        # Analyze results
        time.sleep(2)  # Wait for files to be written
        csv_prefix = f"load_test_{datetime.now().strftime('%Y%m%d')}"
        
        # Find most recent CSV
        csv_files = sorted(glob.glob('load_test_*_stats.csv'))
        if csv_files:
            latest_csv = csv_files[-1].replace('_stats.csv', '')
            analyze_results(latest_csv)
    
    print("\n✅ Load test complete!")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
