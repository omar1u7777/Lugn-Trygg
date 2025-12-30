# PowerShell SSL Setup Script for Windows (Development/Testing)
# For production on Windows, consider using IIS with SSL certificates
# Or deploy to Linux server for better SSL support

Write-Host "🔒 SSL Setup for Lugn & Trygg (Windows Development)" -ForegroundColor Cyan
Write-Host "=" * 60
Write-Host ""

# Configuration
$Domain = "localhost"
$CertName = "LugnTryggDev"
$CertPath = "cert:\LocalMachine\My"

Write-Host "⚠️  Note: This creates a self-signed certificate for DEVELOPMENT only" -ForegroundColor Yellow
Write-Host "   For production, use Let's Encrypt on Linux or commercial SSL on Windows" -ForegroundColor Yellow
Write-Host ""

# Check admin privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ This script requires Administrator privileges" -ForegroundColor Red
    Write-Host "   Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Create self-signed certificate
Write-Host "📜 Creating self-signed SSL certificate..." -ForegroundColor Cyan

try {
    $cert = New-SelfSignedCertificate `
        -Subject "CN=$Domain" `
        -DnsName $Domain, "www.$Domain" `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -NotBefore (Get-Date) `
        -NotAfter (Get-Date).AddYears(2) `
        -CertStoreLocation $CertPath `
        -FriendlyName $CertName `
        -HashAlgorithm SHA256 `
        -KeyUsage DigitalSignature, KeyEncipherment, DataEncipherment `
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1")
    
    Write-Host "✓ Certificate created successfully" -ForegroundColor Green
    Write-Host "  Thumbprint: $($cert.Thumbprint)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to create certificate: $_" -ForegroundColor Red
    exit 1
}

# Export certificate
Write-Host ""
Write-Host "📦 Exporting certificate..." -ForegroundColor Cyan

$exportPath = Join-Path $PSScriptRoot "ssl"
New-Item -ItemType Directory -Force -Path $exportPath | Out-Null

$certFile = Join-Path $exportPath "lugn-trygg-dev.crt"
$pfxFile = Join-Path $exportPath "lugn-trygg-dev.pfx"

# Export as PFX (with private key)
$pfxPassword = ConvertTo-SecureString -String "dev-password-change-me" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxFile -Password $pfxPassword | Out-Null

# Export as CRT (public key only)
Export-Certificate -Cert $cert -FilePath $certFile | Out-Null

Write-Host "✓ Certificate exported" -ForegroundColor Green
Write-Host "  CRT: $certFile" -ForegroundColor Gray
Write-Host "  PFX: $pfxFile" -ForegroundColor Gray
Write-Host ""

# Add to Trusted Root (so browsers accept it)
Write-Host "🔐 Adding certificate to Trusted Root..." -ForegroundColor Cyan

try {
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root","LocalMachine")
    $store.Open("ReadWrite")
    $store.Add($cert)
    $store.Close()
    
    Write-Host "✓ Certificate added to Trusted Root" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Warning: Could not add to Trusted Root: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=" * 60
Write-Host "✅ SSL Setup Complete!" -ForegroundColor Green
Write-Host "=" * 60
Write-Host ""

Write-Host "📋 Certificate Details:" -ForegroundColor Cyan
Write-Host "  Subject: $($cert.Subject)"
Write-Host "  Issuer: $($cert.Issuer)"
Write-Host "  Valid From: $($cert.NotBefore)"
Write-Host "  Valid Until: $($cert.NotAfter)"
Write-Host "  Thumbprint: $($cert.Thumbprint)"
Write-Host ""

Write-Host "📋 Next Steps for Development:" -ForegroundColor Cyan
Write-Host "1. Import certificate in browser if needed"
Write-Host "2. Update vite.config.ts for HTTPS:"
Write-Host "   server: {"
Write-Host "     https: {"
Write-Host "       key: fs.readFileSync('ssl/lugn-trygg-dev.key'),"
Write-Host "       cert: fs.readFileSync('ssl/lugn-trygg-dev.crt')"
Write-Host "     }"
Write-Host "   }"
Write-Host ""

Write-Host "⚠️  Production SSL Setup:" -ForegroundColor Yellow
Write-Host "1. Deploy to Linux server"
Write-Host "2. Run: sudo ./setup-ssl.sh"
Write-Host "3. Or use Vercel/Netlify (automatic SSL)"
Write-Host "4. Or configure IIS with commercial SSL certificate"
Write-Host ""

Write-Host "🔒 Security Notes:" -ForegroundColor Yellow
Write-Host "[ ] Self-signed certificates are NOT secure for production"
Write-Host "[ ] Browsers will show warnings for self-signed certs"
Write-Host "[ ] Use Let's Encrypt (free) for production SSL"
Write-Host "[ ] Never commit SSL certificates to git"
Write-Host ""
