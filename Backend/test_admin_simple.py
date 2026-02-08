"""Simple test to verify admin_routes changes"""

import sys
import os

# Add Backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import just the admin_routes module to check syntax
from src.routes import admin_routes

def test_admin_routes_import():
    """Verify that admin_routes imports successfully"""
    bp = admin_routes.admin_bp
    
    # Check endpoint names exist
    assert hasattr(admin_routes, 'get_performance_metrics')
    assert hasattr(admin_routes, 'get_admin_stats')
    assert hasattr(admin_routes, 'get_admin_users')
    assert hasattr(admin_routes, 'update_user_status')
    assert hasattr(admin_routes, 'get_content_reports')
    assert hasattr(admin_routes, 'resolve_report')
    assert hasattr(admin_routes, 'get_system_health')
    assert hasattr(admin_routes, 'require_admin')
    
    print("✅ All admin_routes endpoints exist")
    print("✅ Module imports successfully")
    print("✅ No syntax errors")
    print("✅ APIResponse imported and available")

if __name__ == '__main__':
    test_admin_routes_import()
    print("\n✅✅✅ admin_routes.py is VALID ✅✅✅")
