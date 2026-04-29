@echo off
:: ============================================
:: Marking Master - Extension Launcher
:: ============================================

:: Set console encoding
chcp 65001 >nul

:: Get script directory
set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%start.ps1"

echo.
echo ============================================
echo Marking Master Extension Launcher
echo ============================================
echo Script Directory: %SCRIPT_DIR%
echo PowerShell Script: %PS_SCRIPT%
echo.

:: Check if PowerShell script exists
if not exist "%PS_SCRIPT%" (
    echo ERROR: start.ps1 not found!
    pause
    exit /b 1
)

echo Starting PowerShell script...
echo.

:: Call PowerShell script with explicit execution policy
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"

:: Check exit code
if %ERRORLEVEL% equ 0 (
    echo.
    echo Script executed successfully.
) else (
    echo.
    echo ERROR: Script failed with exit code %ERRORLEVEL%
)

:: Keep window open so user can see output
echo.
echo Press any key to exit...
pause >nul
