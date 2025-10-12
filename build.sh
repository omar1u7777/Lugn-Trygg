#!/bin/bash

# Lugn & Trygg Production Build Script
# This script builds both web and Electron versions for production

set -e

echo "🚀 Starting Lugn & Trygg production build..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Build type selection
BUILD_TYPE=${1:-all}

case $BUILD_TYPE in
    "web")
        print_status "Building web version only..."
        build_web
        ;;
    "electron")
        print_status "Building Electron desktop app only..."
        build_electron
        ;;
    "docker")
        print_status "Building Docker containers..."
        build_docker
        ;;
    "all")
        print_status "Building all versions (web, Electron, Docker)..."
        build_web
        build_electron
        build_docker
        ;;
    *)
        print_error "Invalid build type. Use: web, electron, docker, or all"
        echo "Usage: $0 [web|electron|docker|all]"
        exit 1
        ;;
esac

print_success "Build completed successfully!"

# Functions
build_web() {
    print_status "Building web application..."
    cd frontend
    npm ci
    npm run build
    cd ..
    print_success "Web build completed"
}

build_electron() {
    print_status "Building Electron desktop application..."
    cd frontend

    # Install dependencies
    npm ci

    # Build the app
    npm run build

    # Build Electron app for current platform
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        npm run build:electron:linux
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        npm run build:electron:mac
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        npm run build:electron:win
    else
        npm run build:electron
    fi

    cd ..
    print_success "Electron build completed"
}

build_docker() {
    print_status "Building Docker containers..."

    # Build production containers
    docker-compose -f docker-compose.prod.yml build

    print_success "Docker build completed"
    print_status "To deploy, run: docker-compose -f docker-compose.prod.yml up -d"
}

# Show build results
echo ""
echo "📦 Build Results:"
if [ -d "frontend/dist" ]; then
    echo "  ✅ Web build: frontend/dist/"
fi
if [ -d "frontend/release" ]; then
    echo "  ✅ Electron build: frontend/release/"
fi
echo ""
echo "🚀 Deployment commands:"
echo "  Web: cd frontend && npm run serve"
echo "  Electron: Open the executable in frontend/release/"
echo "  Docker: docker-compose -f docker-compose.prod.yml up -d"