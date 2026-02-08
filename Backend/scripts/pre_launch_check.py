#!/usr/bin/env python3
"""
Pre-Launch Validation Script
Checks all critical items before production launch
"""

import os
import sys
import json
import subprocess
from datetime import datetime
import urllib.request
import socket

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}\n")

def print_success(text):
    print(f"{Colors.OKGREEN}✓{Colors.ENDC} {text}")

def print_warning(text):
    print(f"{Colors.WARNING}⚠{Colors.ENDC} {text}")

def print_error(text):
    print(f"{Colors.FAIL}✗{Colors.ENDC} {text}")

def print_info(text):
    print(f"{Colors.OKCYAN}ℹ{Colors.ENDC} {text}")

def check_env_file():
    """Check if .env file exists and has required variables."""
    print_header("1. Environment Configuration Check")
    
    # Backend directory is one level up from scripts/
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    env_path = os.path.join(backend_dir, '.env')
    
    if not os.path.exists(env_path):
        print_error(".env file not found")
        print_info("Run: cp .env.production .env")
        return False
    
    print_success(".env file exists")
    
    required_vars = [
        'JWT_SECRET_KEY',
        'JWT_REFRESH_SECRET_KEY',
        'FLASK_SECRET_KEY',
        'FIREBASE_PROJECT_ID',
        'OPENAI_API_KEY',
    ]
    
    with open(env_path, 'r') as f:
        env_content = f.read()
    
    missing = []
    weak = []
    
    for var in required_vars:
        if var not in env_content:
            missing.append(var)
        else:
            # Check if it's a placeholder
            if 'your-' in env_content or 'change-me' in env_content.lower():
                weak.append(var)
            
            # Check JWT secret strength
            if 'JWT_SECRET_KEY' in var:
                lines = [l for l in env_content.split('\n') if l.startswith(var)]
                if lines:
                    value = lines[0].split('=')[1].strip()
                    if len(value) < 32:
                        print_warning(f"{var} is too short (< 32 chars)")
                        weak.append(var)
    
    if missing:
        print_error(f"Missing variables: {', '.join(missing)}")
        return False
    
    if weak:
        print_warning(f"Weak/placeholder variables: {', '.join(weak)}")
        print_info("Run: python generate_secrets.py")
        return False
    
    print_success("All required environment variables present and valid")
    return True

def check_backend_health():
    """Check if backend is running and healthy."""
    print_header("2. Backend Health Check")
    
    try:
        req = urllib.request.Request('http://localhost:5001/api/health')
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            
            if data.get('status') == 'healthy':
                print_success("Backend is healthy")
                print_info(f"  Version: {data.get('version', 'unknown')}")
                print_info(f"  Environment: {data.get('environment', 'unknown')}")
                return True
            else:
                print_error(f"Backend unhealthy: {data}")
                return False
                
    except Exception as e:
        print_error(f"Backend not accessible: {e}")
        print_info("Start backend: cd Backend && python main.py")
        return False

def check_frontend_build():
    """Check if frontend build exists and is recent."""
    print_header("3. Frontend Build Check")
    
    # Project root is two levels up from scripts/ (Backend/scripts/ -> Backend/ -> Project root)
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    dist_path = os.path.join(project_root, 'dist')
    
    if not os.path.exists(dist_path):
        print_error("Frontend build not found")
        print_info("Run: npm run build")
        return False
    
    print_success("Frontend build exists")
    
    # Check build timestamp
    index_path = os.path.join(dist_path, 'index.html')
    if os.path.exists(index_path):
        mtime = os.path.getmtime(index_path)
        build_age = (datetime.now().timestamp() - mtime) / 3600  # hours
        
        if build_age < 24:
            print_success(f"Build is recent ({build_age:.1f} hours old)")
        else:
            print_warning(f"Build is {build_age:.1f} hours old")
            print_info("Consider rebuilding: npm run build")
    
    # Check bundle size
    try:
        import glob
        js_files = glob.glob(os.path.join(dist_path, 'assets', '*.js'))
        if js_files:
            total_size = sum(os.path.getsize(f) for f in js_files) / 1024  # KB
            if total_size < 250:
                print_success(f"Bundle size OK: {total_size:.1f} KB")
            else:
                print_warning(f"Bundle size large: {total_size:.1f} KB (target < 250KB)")
    except:
        pass
    
    return True

def check_ssl_certificate():
    """Check if SSL certificate is configured."""
    print_header("4. SSL/HTTPS Check")
    
    # Check if nginx config exists
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    nginx_config = os.path.join(project_root, 'nginx-production.conf')
    
    if not os.path.exists(nginx_config):
        print_error("nginx-production.conf not found")
        return False
    
    print_success("Nginx production config exists")
    
    # Try to check if HTTPS is working (only if domain configured)
    domain = os.getenv('DOMAIN', '').strip()
    
    if domain and domain != 'localhost':
        try:
            req = urllib.request.Request(f'https://{domain}/api/health')
            with urllib.request.urlopen(req, timeout=5) as response:
                print_success(f"HTTPS working on {domain}")
                return True
        except Exception as e:
            print_warning(f"HTTPS not accessible on {domain}: {e}")
            print_info("Run: sudo ./setup-ssl.sh")
            return False
    else:
        print_warning("Domain not configured - HTTPS not testable")
        print_info("Set DOMAIN env variable or run setup-ssl.sh on production server")
        return False

def check_monitoring():
    """Check if monitoring is configured."""
    print_header("5. Monitoring Configuration Check")
    
    sentry_dsn = os.getenv('SENTRY_DSN', '').strip()
    
    if sentry_dsn and sentry_dsn != '' and 'your-' not in sentry_dsn:
        print_success("Sentry DSN configured")
        
        # Try to verify Sentry is working
        try:
            import sentry_sdk
            sentry_sdk.init(dsn=sentry_dsn, traces_sample_rate=0.0)
            print_success("Sentry SDK initialized successfully")
            return True
        except Exception as e:
            print_warning(f"Sentry initialization issue: {e}")
            return False
    else:
        print_error("Sentry DSN not configured")
        print_info("1. Create account at https://sentry.io")
        print_info("2. Get DSN key")
        print_info("3. Add to .env: SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx")
        return False

def check_load_test():
    """Check if load test has been run."""
    print_header("6. Load Test Status")
    
    # Check if Locust is installed
    try:
        subprocess.run(['locust', '--version'], 
                      capture_output=True, 
                      check=True,
                      timeout=5)
        print_success("Locust installed")
    except Exception:
        print_error("Locust not installed")
        print_info("Run: pip install locust")
        return False
    
    # Check for recent test results
    import glob
    reports = glob.glob(os.path.join(os.path.dirname(__file__), 'load_test_report_*.html'))
    
    if reports:
        latest = max(reports, key=os.path.getmtime)
        age = (datetime.now().timestamp() - os.path.getmtime(latest)) / 3600
        
        if age < 24:
            print_success(f"Load test report found ({age:.1f} hours old)")
            print_info(f"Report: {os.path.basename(latest)}")
        else:
            print_warning(f"Load test report is {age:.1f} hours old")
            print_info("Run: python run_load_test.py")
        
        return True
    else:
        print_warning("No load test reports found")
        print_info("Run: python run_load_test.py")
        return False

def check_backups():
    """Check if backup system has been tested."""
    print_header("7. Backup System Check")
    
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    backup_script = os.path.join(backend_dir, 'scripts', 'backup_firestore.py')
    
    if not os.path.exists(backup_script):
        print_error("Backup script not found")
        return False
    
    print_success("Backup script exists")
    
    # Check for recent backups
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    backup_dir = os.path.join(backend_dir, 'backups')
    
    if os.path.exists(backup_dir):
        backups = os.listdir(backup_dir)
        if backups:
            print_success(f"Found {len(backups)} backup files")
            
            # Check age of most recent backup
            latest = max([os.path.join(backup_dir, f) for f in backups], 
                        key=os.path.getmtime)
            age = (datetime.now().timestamp() - os.path.getmtime(latest)) / 3600
            
            if age < 24:
                print_success(f"Recent backup found ({age:.1f} hours old)")
            else:
                print_warning(f"Latest backup is {age:.1f} hours old")
            
            return True
        else:
            print_warning("No backup files found")
            print_info("Run: python backup_firestore.py")
            return False
    else:
        print_warning("Backups directory not found")
        print_info("Run: python backup_firestore.py")
        return False

def check_security():
    """Run basic security checks."""
    print_header("8. Security Check")
    
    checks_passed = 0
    total_checks = 4
    
    # Check if .env is in gitignore
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    gitignore_path = os.path.join(project_root, '.gitignore')
    if os.path.exists(gitignore_path):
        with open(gitignore_path, 'r') as f:
            content = f.read()
            if '.env' in content:
                print_success(".env in .gitignore")
                checks_passed += 1
            else:
                print_error(".env not in .gitignore - SECURITY RISK!")
    
    # Check if secrets_backup should be deleted
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    secrets_backup = os.path.join(backend_dir, 'secrets_backup')
    if os.path.exists(secrets_backup):
        print_warning("secrets_backup/ folder still exists")
        print_info("DELETE THIS FOLDER: rm -rf Backend/secrets_backup/")
    else:
        print_success("secrets_backup/ cleaned up")
        checks_passed += 1
    
    # Check JWT secret strength
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    env_path = os.path.join(backend_dir, '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            content = f.read()
            if 'dev-secret-key' in content or 'change-in-production' in content:
                print_error("Default secrets detected - MUST CHANGE!")
            else:
                print_success("Custom secrets in use")
                checks_passed += 1
    
    # Check CORS configuration
    if 'CORS_ORIGINS' in os.environ or 'CORS_ALLOWED_ORIGINS' in os.environ:
        cors = os.getenv('CORS_ORIGINS', os.getenv('CORS_ALLOWED_ORIGINS', ''))
        if 'localhost' in cors and 'https://' not in cors:
            print_warning("CORS configured for localhost only")
            print_info("Update .env: CORS_ORIGINS=https://yourdomain.com")
        else:
            print_success("CORS configured for production")
            checks_passed += 1
    
    return checks_passed >= 3

def main():
    """Run all pre-launch checks."""
    print(f"\n{Colors.BOLD}{'*'*70}{Colors.ENDC}")
    print(f"{Colors.BOLD}{'*':^70}{Colors.ENDC}")
    print(f"{Colors.BOLD}{'Lugn & Trygg - Pre-Launch Validation':^70}{Colors.ENDC}")
    print(f"{Colors.BOLD}{'*':^70}{Colors.ENDC}")
    print(f"{Colors.BOLD}{'*'*70}{Colors.ENDC}")
    
    checks = [
        ("Environment", check_env_file),
        ("Backend", check_backend_health),
        ("Frontend", check_frontend_build),
        ("SSL/HTTPS", check_ssl_certificate),
        ("Monitoring", check_monitoring),
        ("Load Test", check_load_test),
        ("Backups", check_backups),
        ("Security", check_security),
    ]
    
    results = {}
    
    for name, check_func in checks:
        try:
            results[name] = check_func()
        except Exception as e:
            print_error(f"Check failed with error: {e}")
            results[name] = False
    
    # Summary
    print_header("Summary")
    
    passed = sum(results.values())
    total = len(results)
    percentage = (passed / total) * 100
    
    print(f"\nChecks Passed: {passed}/{total} ({percentage:.1f}%)\n")
    
    for name, result in results.items():
        if result:
            print_success(f"{name}: PASS")
        else:
            print_error(f"{name}: FAIL")
    
    print("\n" + "="*70 + "\n")
    
    if passed == total:
        print(f"{Colors.OKGREEN}{Colors.BOLD}✅ ALL CHECKS PASSED - READY FOR LAUNCH!{Colors.ENDC}\n")
        return 0
    elif passed >= total * 0.8:
        print(f"{Colors.WARNING}{Colors.BOLD}⚠️  MOSTLY READY - Address remaining issues{Colors.ENDC}\n")
        print("See PRODUCTION_LAUNCH_CHECKLIST.md for details\n")
        return 1
    else:
        print(f"{Colors.FAIL}{Colors.BOLD}❌ NOT READY - Critical issues found{Colors.ENDC}\n")
        print("Work through PRODUCTION_LAUNCH_CHECKLIST.md before launch\n")
        return 2

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}Interrupted by user{Colors.ENDC}")
        sys.exit(130)
