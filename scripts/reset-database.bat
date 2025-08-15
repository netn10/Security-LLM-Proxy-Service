@echo off
echo ========================================
echo    Lasso Proxy Database Reset Tool
echo ========================================
echo.

echo This will permanently delete all data in the database!
echo.
set /p confirm="Are you sure you want to continue? (y/N): "

if /i "%confirm%"=="y" (
    echo.
    echo Starting database reset...
    node scripts/reset-database.js --confirm
) else (
    echo.
    echo Database reset cancelled.
)

echo.
pause
