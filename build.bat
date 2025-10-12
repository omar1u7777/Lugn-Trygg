@echo off
REM Lugn & Trygg Production Build Script for Windows
REM This script builds both web and Electron versions for production

echo 🚀 Starting Lugn & Trygg production build...

REM Build type selection
set BUILD_TYPE=%1
if "%BUILD_TYPE%"=="" set BUILD_TYPE=all

if "%BUILD_TYPE%"=="web" goto build_web
if "%BUILD_TYPE%"=="electron" goto build_electron
if "%BUILD_TYPE%"=="docker" goto build_docker
if "%BUILD_TYPE%"=="all" goto build_all

echo Invalid build type. Use: web, electron, docker, or all
echo Usage: build.bat [web^|electron^|docker^|all]
goto end

:build_all
echo Building all versions (web, Electron, Docker)...
call :build_web
call :build_electron
call :build_docker
goto results

:build_web
echo Building web application...
cd frontend
call npm ci
call npm run build
cd ..
echo ✅ Web build completed
goto :eof

:build_electron
echo Building Electron desktop application...
cd frontend

REM Install dependencies
call npm ci

REM Build the app
call npm run build

REM Build Electron app for Windows
call npm run build:electron:win

cd ..
echo ✅ Electron build completed
goto :eof

:build_docker
echo Building Docker containers...
docker-compose -f docker-compose.prod.yml build
echo ✅ Docker build completed
echo To deploy, run: docker-compose -f docker-compose.prod.yml up -d
goto :eof

:results
echo.
echo 📦 Build Results:
if exist "frontend\dist" echo   ✅ Web build: frontend\dist\
if exist "frontend\release" echo   ✅ Electron build: frontend\release\
echo.
echo 🚀 Deployment commands:
echo   Web: cd frontend ^&^& npm run serve
echo   Electron: Open the executable in frontend\release\
echo   Docker: docker-compose -f docker-compose.prod.yml up -d

:end
echo ✅ Build completed successfully!