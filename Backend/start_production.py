#!/usr/bin/env python3
"""
Production Server Startup Script
För 1000+ användare med Gunicorn WSGI server
"""
import os
import sys
from pathlib import Path

# Set production environment variables
os.environ['FLASK_ENV'] = 'production'
os.environ['FLASK_DEBUG'] = 'False'
os.environ['WERKZEUG_RUN_MAIN'] = 'false'

print("=" * 60)
print("🚀 LUGN & TRYGG - PRODUCTION SERVER")
print("=" * 60)
print(f"📍 Environment: {os.getenv('FLASK_ENV', 'production')}")
print(f"🔧 Debug Mode: {os.getenv('FLASK_DEBUG', 'False')}")
print(f"⚙️  Port: {os.getenv('PORT', '5001')}")
print("=" * 60)

# Check if gunicorn is installed
try:
    import gunicorn
    print("✅ Gunicorn installed")
except ImportError:
    print("❌ Gunicorn not found. Installing...")
    os.system(f"{sys.executable} -m pip install gunicorn")
    
# Start server with Gunicorn
gunicorn_cmd = [
    "gunicorn",
    "--config", "gunicorn.conf.py",
    "main:app"
]

print("\n🎯 Starting production server with Gunicorn...")
print(f"Command: {' '.join(gunicorn_cmd)}\n")

os.execvp("gunicorn", gunicorn_cmd)
