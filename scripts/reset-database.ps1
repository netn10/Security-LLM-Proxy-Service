# Lasso Proxy Database Reset Tool
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Lasso Proxy Database Reset Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This will permanently delete all data in the database!" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Are you sure you want to continue? (y/N)"

if ($confirm -eq "y" -or $confirm -eq "Y") {
    Write-Host ""
    Write-Host "Starting database reset..." -ForegroundColor Green
    node scripts/reset-database.js --confirm
} else {
    Write-Host ""
    Write-Host "Database reset cancelled." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to continue"
