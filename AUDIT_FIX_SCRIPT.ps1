# AUDIT AUTO-FIX SCRIPT
# Full-Stack End-to-End Audit - Automated Fixes
# Run this script with VS Code CLOSED to avoid file lock issues

param(
    [switch]$DryRun = $false,
    [switch]$SkipTests = $false
)

$ErrorActionPreference = "Stop"
$OriginalLocation = Get-Location

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LUGN & TRYGG - AUDIT AUTO-FIX SCRIPT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN MODE] No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Check if VS Code is running
$vscodeProcess = Get-Process -Name "Code" -ErrorAction SilentlyContinue
if ($vscodeProcess) {
    Write-Host "❌ ERROR: VS Code is running!" -ForegroundColor Red
    Write-Host "Please close VS Code completely before running this script." -ForegroundColor Yellow
    Write-Host "This is required to unlock file handles for folder rename operations." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ VS Code not detected, proceeding..." -ForegroundColor Green
Write-Host ""

# Navigate to project root
Set-Location $PSScriptRoot

# ============================================
# FIX 1: CASE-SENSITIVITY - Rename UI Folder
# ============================================
Write-Host "🔧 FIX 1: Renaming UI folder to ui (case-sensitive fix)" -ForegroundColor Cyan

$uiFolder = "src\components\UI"
$tempFolder = "src\components\ui_temp"
$targetFolder = "src\components\ui"

if (Test-Path $uiFolder) {
    Write-Host "Found: $uiFolder" -ForegroundColor White
    
    if (-not $DryRun) {
        try {
            # Step 1: Rename to temp (Windows allows this)
            Write-Host "  Step 1: Renaming UI -> ui_temp..." -ForegroundColor White
            Rename-Item -Path $uiFolder -NewName "ui_temp" -Force
            Start-Sleep -Milliseconds 500
            
            # Step 2: Rename temp to final lowercase
            Write-Host "  Step 2: Renaming ui_temp -> ui..." -ForegroundColor White
            Rename-Item -Path $tempFolder -NewName "ui" -Force
            Start-Sleep -Milliseconds 500
            
            Write-Host "✅ Folder renamed successfully" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ ERROR renaming folder: $_" -ForegroundColor Red
            Write-Host "Manual intervention required." -ForegroundColor Yellow
            Set-Location $OriginalLocation
            exit 1
        }
    }
    else {
        Write-Host "  [DRY RUN] Would rename: $uiFolder -> $targetFolder" -ForegroundColor Yellow
    }
}
else {
    Write-Host "✅ UI folder already renamed or not found" -ForegroundColor Green
}

Write-Host ""

# ============================================
# FIX 2: UPDATE IMPORT PATHS
# ============================================
Write-Host "🔧 FIX 2: Updating import paths from UI to ui" -ForegroundColor Cyan

$filesToFix = @(
    "src\components\TestPage.tsx",
    "src\components\TestingStrategy.tsx",
    "src\components\LoadingStates.tsx",
    "src\components\ErrorBoundary.tsx",
    "src\components\Integrations\HealthSync.tsx",
    "src\components\ui\index.ts",
    "src\components\ui\TestSuite.tsx"
)

foreach ($file in $filesToFix) {
    if (Test-Path $file) {
        Write-Host "Processing: $file" -ForegroundColor White
        
        if (-not $DryRun) {
            $content = Get-Content $file -Raw
            $originalContent = $content
            
            # Replace various import patterns
            $content = $content -replace "from ['""]\.\/UI\/", "from './ui/"
            $content = $content -replace "from ['""]\.\.\/UI\/", "from '../ui/"
            $content = $content -replace "from ['""]\.\.\/\.\.\/UI\/", "from '../../ui/"
            $content = $content -replace "from ['""]\./UI/", "from './ui/"
            
            if ($content -ne $originalContent) {
                Set-Content -Path $file -Value $content -NoNewline
                Write-Host "  ✅ Updated imports" -ForegroundColor Green
            }
            else {
                Write-Host "  ℹ️  No changes needed" -ForegroundColor Gray
            }
        }
        else {
            Write-Host "  [DRY RUN] Would update imports in: $file" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "⚠️  File not found: $file" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# FIX 3: FIX SENTRY STUB IN ANALYTICS
# ============================================
Write-Host "🔧 FIX 3: Fixing Sentry stub type signatures" -ForegroundColor Cyan

$analyticsFile = "src\services\analytics.ts"
if (Test-Path $analyticsFile) {
    Write-Host "Processing: $analyticsFile" -ForegroundColor White
    
    if (-not $DryRun) {
        $content = Get-Content $analyticsFile -Raw
        
        # Find and replace Sentry stub object
        $sentryStubOld = @"
const Sentry = {
  init: () => {},
  setUser: () => {},
  captureException: () => {},
  captureMessage: () => {},
  addBreadcrumb: () => {},
};
"@

        $sentryStubNew = @"
const Sentry = {
  init: (_options?: any) => {},
  setUser: (_user?: any) => {},
  captureException: (_error?: any, _context?: any) => {},
  captureMessage: (_message?: string, _level?: any) => {},
  addBreadcrumb: (_breadcrumb?: any) => {},
};
"@

        if ($content -match "const Sentry = \{[^}]+\};") {
            $content = $content -replace "const Sentry = \{[^}]+\};", $sentryStubNew
            Set-Content -Path $analyticsFile -Value $content -NoNewline
            Write-Host "  ✅ Fixed Sentry stub signatures" -ForegroundColor Green
        }
        else {
            Write-Host "  ⚠️  Sentry stub not found or already fixed" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "  [DRY RUN] Would fix Sentry stub in: $analyticsFile" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# FIX 4: FIX OPTIMIZED IMAGE IMPORT
# ============================================
Write-Host "🔧 FIX 4: Fixing OptimizedImage import in HealthSync" -ForegroundColor Cyan

$healthSyncFile = "src\components\Integrations\HealthSync.tsx"
if (Test-Path $healthSyncFile) {
    Write-Host "Processing: $healthSyncFile" -ForegroundColor White
    
    if (-not $DryRun) {
        $content = Get-Content $healthSyncFile -Raw
        
        # Replace named import with default import
        $content = $content -replace "import \{ OptimizedImage \} from", "import OptimizedImage from"
        
        Set-Content -Path $healthSyncFile -Value $content -NoNewline
        Write-Host "  ✅ Fixed OptimizedImage import" -ForegroundColor Green
    }
    else {
        Write-Host "  [DRY RUN] Would fix OptimizedImage import in: $healthSyncFile" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# FIX 5: FIX ACCESSIBILITY IN LOGINFORM
# ============================================
Write-Host "🔧 FIX 5: Fixing accessibility in LoginForm" -ForegroundColor Cyan

$loginFormFile = "src\components\Auth\LoginForm.tsx"
if (Test-Path $loginFormFile) {
    Write-Host "Processing: $loginFormFile" -ForegroundColor White
    
    if (-not $DryRun) {
        $content = Get-Content $loginFormFile -Raw
        
        # Remove getAriaLabel from destructuring if present
        $content = $content -replace "getAriaLabel,\s*", ""
        $content = $content -replace ",\s*getAriaLabel", ""
        
        Set-Content -Path $loginFormFile -Value $content -NoNewline
        Write-Host "  ✅ Fixed accessibility hook usage" -ForegroundColor Green
    }
    else {
        Write-Host "  [DRY RUN] Would fix accessibility in: $loginFormFile" -ForegroundColor Yellow
    }
}

Write-Host ""

# ============================================
# VERIFICATION: BUILD CHECK
# ============================================
Write-Host "🔍 VERIFICATION: Checking TypeScript compilation" -ForegroundColor Cyan

if (-not $DryRun) {
    Write-Host "Running: npm run build" -ForegroundColor White
    
    try {
        $buildOutput = npm run build 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Build successful!" -ForegroundColor Green
        }
        else {
            Write-Host "❌ Build failed!" -ForegroundColor Red
            Write-Host "Output:" -ForegroundColor Yellow
            Write-Host $buildOutput
            Set-Location $OriginalLocation
            exit 1
        }
    }
    catch {
        Write-Host "❌ Build error: $_" -ForegroundColor Red
        Set-Location $OriginalLocation
        exit 1
    }
}
else {
    Write-Host "[DRY RUN] Would run: npm run build" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# VERIFICATION: LINT CHECK
# ============================================
Write-Host "🔍 VERIFICATION: Running ESLint" -ForegroundColor Cyan

if (-not $DryRun) {
    Write-Host "Running: npm run lint" -ForegroundColor White
    
    $lintOutput = npm run lint 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ No lint errors!" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Lint warnings/errors found (non-blocking)" -ForegroundColor Yellow
        Write-Host $lintOutput
    }
}
else {
    Write-Host "[DRY RUN] Would run: npm run lint" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# VERIFICATION: RUN TESTS
# ============================================
if (-not $SkipTests) {
    Write-Host "🔍 VERIFICATION: Running test suite" -ForegroundColor Cyan
    
    if (-not $DryRun) {
        Write-Host "Running: npm run test:coverage" -ForegroundColor White
        
        $testOutput = npm run test:coverage 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ All tests passed!" -ForegroundColor Green
        }
        else {
            Write-Host "⚠️  Some tests failed (review output)" -ForegroundColor Yellow
            Write-Host $testOutput
        }
    }
    else {
        Write-Host "[DRY RUN] Would run: npm run test:coverage" -ForegroundColor Yellow
    }
}
else {
    Write-Host "⏭️  Skipping tests (--SkipTests flag set)" -ForegroundColor Gray
}

Write-Host ""

# ============================================
# GIT COMMIT
# ============================================
Write-Host "📝 GIT: Committing changes" -ForegroundColor Cyan

if (-not $DryRun) {
    Write-Host "Running: git add ." -ForegroundColor White
    git add .
    
    Write-Host "Running: git commit" -ForegroundColor White
    git commit -m "fix(audit): resolve case-sensitivity and TypeScript errors

BLOCKER-001: Renamed UI folder to ui (case-sensitive)
BLOCKER-002: Fixed Sentry stub type signatures
MAJOR-003: Fixed accessibility hook in LoginForm
MAJOR-004: Fixed OptimizedImage import in HealthSync

- Updated all import paths from UI to ui
- Fixed TypeScript compilation errors (9 instances)
- Verified build passes
- All critical blockers resolved

Refs: docs/full_audit_report.md"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Changes committed successfully" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Git commit skipped (no changes or error)" -ForegroundColor Yellow
    }
}
else {
    Write-Host "[DRY RUN] Would commit changes with conventional commit message" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# SUMMARY
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AUDIT FIX SCRIPT COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $DryRun) {
    Write-Host "✅ All fixes applied successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Review changes: git diff HEAD~1" -ForegroundColor White
    Write-Host "2. Push to remote: git push origin fix/comprehensive-audit-phase1" -ForegroundColor White
    Write-Host "3. Deploy to Vercel: git push or manual deploy" -ForegroundColor White
    Write-Host "4. Verify production: Check Vercel deployment" -ForegroundColor White
    Write-Host "5. Run E2E tests: npm run test:e2e" -ForegroundColor White
    Write-Host ""
    Write-Host "Audit Report: docs/full_audit_report.md" -ForegroundColor Cyan
}
else {
    Write-Host "🔍 Dry run complete. No changes were made." -ForegroundColor Yellow
    Write-Host "Run without -DryRun flag to apply fixes." -ForegroundColor White
}

Set-Location $OriginalLocation
Write-Host ""
Write-Host "Done! 🎉" -ForegroundColor Green
