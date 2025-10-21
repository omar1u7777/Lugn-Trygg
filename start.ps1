# 🚀 Snabbstart Script för Backend + Tester
# Enklare version - startar allt automatiskt

Write-Host ""
Write-Host "╔═══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   🚀 LUGN & TRYGG - SNABBSTART           ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Kör fullständiga tester
.\run-tests.ps1

Write-Host ""
Write-Host "Klart! Tryck valfri tangent för att avsluta..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
