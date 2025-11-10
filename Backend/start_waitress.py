"""
Start Waitress WSGI server for Windows
Production-ready server that doesn't timeout like Flask dev server
"""
import os
import sys
from waitress import serve

# Add Backend directory to path
sys.path.insert(0, os.path.dirname(__file__))

from main import app

if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5001))
    threads = int(os.getenv('WAITRESS_THREADS', 16))  # Ökat från 4 till 16 för 1000+ users
    
    print(f"🚀 Starting Waitress server on {host}:{port} with {threads} threads...")
    print(f"📊 Environment: {os.getenv('FLASK_ENV', 'development')}")
    print(f"⚙️  Press Ctrl+C to quit")
    
    serve(
        app,
        host=host,
        port=port,
        threads=threads,
        url_scheme='http',
        channel_timeout=300,  # Ökat från 120 till 300s
        cleanup_interval=30,
        connection_limit=2000,  # Max 2000 simultana connections
        asyncore_use_poll=True,  # Bättre performance under Windows
        _quiet=False
    )
