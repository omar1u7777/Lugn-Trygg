#!/bin/bash
# 🚀 PRODUCTION DEPLOYMENT SCRIPT - Lugn & Trygg Backend
# Run this script to deploy backend for 1000 users

set -e  # Exit on error

echo "🚀 Starting Lugn & Trygg Backend Production Deployment..."
echo "=================================================="

# Check if running in Backend directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: Must run from Backend directory!"
    exit 1
fi

# 1. Load production environment
echo "📝 Loading production environment..."
if [ -f ".env.production" ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
    echo "✅ Production environment loaded"
else
    echo "⚠️  Warning: .env.production not found, using .env"
fi

# 2. Install dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt --no-cache-dir
echo "✅ Dependencies installed"

# 3. Verify critical packages
echo "🔍 Verifying critical packages..."
python -c "import flask; import firebase_admin; import pandas; print('✅ All critical packages available')"

# 4. Check Firebase credentials
echo "🔥 Checking Firebase credentials..."
if [ ! -f "serviceAccountKey.json" ]; then
    echo "❌ Error: serviceAccountKey.json not found!"
    exit 1
fi
echo "✅ Firebase credentials found"

# 5. Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs
echo "✅ Logs directory ready"

# 6. Run database migrations (if any)
# echo "🗄️  Running database migrations..."
# python scripts/migrate.py
# echo "✅ Migrations complete"

# 7. Start Gunicorn with production config
echo "🌟 Starting Gunicorn production server..."
echo "=================================================="
echo "Workers: CPU * 2 + 1 (auto-detected)"
echo "Port: ${PORT:-5001}"
echo "Environment: production"
echo "=================================================="

# Start Gunicorn
gunicorn -c gunicorn_config.py main:app

# If Gunicorn fails, show logs
if [ $? -ne 0 ]; then
    echo "❌ Gunicorn failed to start!"
    echo "Check logs/error.log for details"
    exit 1
fi
