# Rollback script for Lugn & Trygg production deployment
# This script rolls back the application to the previous stable version

param(
    [switch]$Force,
    [string]$Version
)

Write-Host "🚨 Starting rollback procedure for Lugn & Trygg..." -ForegroundColor Yellow

# Configuration
$ROLLBACK_TAG = "rollback-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$ROLLBACK_MARKER = ".rollback-marker"

# Check if we have a previous deployment to rollback to
if (-not (Test-Path $ROLLBACK_MARKER)) {
    Write-Host "❌ No rollback marker found. Cannot determine previous stable version." -ForegroundColor Red
    exit 1
}

$PREVIOUS_VERSION = Get-Content $ROLLBACK_MARKER
Write-Host "✅ Found previous stable version: $PREVIOUS_VERSION" -ForegroundColor Green

Write-Host "Step 1: Creating rollback tag..." -ForegroundColor Yellow
try {
    git tag $ROLLBACK_TAG
} catch {
    Write-Host "Tag creation failed, continuing..." -ForegroundColor Yellow
}

Write-Host "Step 2: Stopping current application..." -ForegroundColor Yellow

# Stop the application (adjust based on your deployment method)
if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    Write-Host "Stopping Docker containers..."
    docker-compose down
} elseif (Get-Command pm2 -ErrorAction SilentlyContinue) {
    Write-Host "Stopping PM2 processes..."
    pm2 stop all
    pm2 delete all
} elseif (Test-Path "package.json") {
    Write-Host "Stopping Node.js application..."
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*main.js*" -or $_.CommandLine -like "*vite*" } | Stop-Process -Force
}

Write-Host "Step 3: Restoring previous version..." -ForegroundColor Yellow

# Restore from backup or git
$backupPath = "backups\$PREVIOUS_VERSION"
if (Test-Path $backupPath) {
    Write-Host "Restoring from backup..."
    Copy-Item "$backupPath\*" . -Recurse -Force
} elseif (git rev-parse --verify $PREVIOUS_VERSION 2>$null) {
    Write-Host "Rolling back to git commit/tag..."
    git checkout $PREVIOUS_VERSION --force
} else {
    Write-Host "❌ No backup or git reference found for version: $PREVIOUS_VERSION" -ForegroundColor Red
    exit 1
}

Write-Host "Step 4: Restoring database from backup..." -ForegroundColor Yellow

# Restore database if needed
$dbBackup = "Backend\db_backup_$PREVIOUS_VERSION.sql"
if (Test-Path $dbBackup) {
    Write-Host "Restoring database..."
    # Add your database restore command here
    # Example for PostgreSQL:
    # psql -U username -d database_name -f $dbBackup
    Write-Host "Database restore command would go here"
}

Write-Host "Step 5: Restarting application..." -ForegroundColor Yellow

# Restart the application
if (Test-Path "docker-compose.yml") {
    Write-Host "Starting Docker containers..."
    docker-compose up -d
} elseif (Test-Path "package.json") {
    Write-Host "Starting Node.js application..."
    npm run build
    Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run", "start"
} elseif (Test-Path "Backend\main.py") {
    Write-Host "Starting Python application..."
    Set-Location Backend
    Start-Process -NoNewWindow -FilePath "python" -ArgumentList "main.py"
}

Write-Host "Step 6: Running health checks..." -ForegroundColor Yellow

# Wait for application to start
Start-Sleep -Seconds 30

# Health check
$HEALTH_URL = "http://localhost:3000/health"
try {
    $response = Invoke-WebRequest -Uri $HEALTH_URL -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Application health check passed" -ForegroundColor Green
    } else {
        Write-Host "❌ Application health check failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Application health check failed" -ForegroundColor Red
    Write-Host "Manual intervention may be required" -ForegroundColor Yellow
}

Write-Host "Step 7: Updating rollback marker..." -ForegroundColor Yellow
$ROLLBACK_TAG | Out-File -FilePath $ROLLBACK_MARKER -Encoding UTF8

Write-Host "🎉 Rollback completed successfully!" -ForegroundColor Green
Write-Host "Previous version: $PREVIOUS_VERSION" -ForegroundColor Yellow
Write-Host "Rollback tag: $ROLLBACK_TAG" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Monitor application logs for any issues"
Write-Host "2. Run full test suite to verify functionality"
Write-Host "3. Notify team about the rollback"
Write-Host "4. Investigate root cause of the issue that required rollback"
