@echo off
setlocal enabledelayedexpansion

echo [INFO] Starting Lugn and Trygg production build...

REM Build type selection
set "BUILD_TYPE=%~1"
if "%BUILD_TYPE%"=="" set "BUILD_TYPE=all"

if "%BUILD_TYPE%"=="web" goto build_web
if "%BUILD_TYPE%"=="electron" goto build_electron
if "%BUILD_TYPE%"=="docker" goto build_docker
if "%BUILD_TYPE%"=="all" goto build_all

echo [ERROR] Invalid build type. Use: web, electron, docker, or all
echo Usage: build.bat [web^|electron^|docker^|all]
goto end

:build_all
echo [INFO] Building all versions ^(web, Electron, Docker^)...
call :build_web
call :build_electron
call :build_docker
goto results

:build_web
echo [INFO] Building web application...
cd frontend
call npm ci
if errorlevel 1 (
    echo [ERROR] npm ci failed
    cd ..
    exit /b 1
)
call npm run build
if errorlevel 1 (
    echo [ERROR] npm run build failed
    cd ..
    exit /b 1
)
cd ..
echo [SUCCESS] Web build completed
goto :eof

:build_electron
echo [INFO] Building Electron desktop application...
cd frontend

REM Install dependencies
call npm ci
if errorlevel 1 (
    echo [ERROR] npm ci failed
    cd ..
    exit /b 1
)

REM Build the app
call npm run build
if errorlevel 1 (
    echo [ERROR] npm run build failed
    cd ..
    exit /b 1
)

REM Build Electron app for Windows
call npm run build:electron:win
if errorlevel 1 (
    echo [ERROR] Electron build failed
    cd ..
    exit /b 1
)

cd ..
echo [SUCCESS] Electron build completed
goto :eof

:build_docker
echo [INFO] Building Docker containers...
docker-compose -f docker-compose.prod.yml build
if errorlevel 1 (
    echo [ERROR] Docker build failed
    goto :eof
)
echo [SUCCESS] Docker build completed
echo To deploy, run: docker-compose -f docker-compose.prod.yml up -d
goto :eof

:results
echo.
echo [INFO] Build Results:
if exist "frontend\dist" echo   [SUCCESS] Web build: frontend\dist\
if exist "frontend\release" echo   [SUCCESS] Electron build: frontend\release\
echo.
echo [INFO] Deployment commands:
echo   Web: cd frontend ^& npm run serve
echo   Electron: Open the executable in frontend\release\
echo   Docker: docker-compose -f docker-compose.prod.yml up -d

:end
echo [SUCCESS] Build completed successfully^!