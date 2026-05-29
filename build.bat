@echo off
echo Compiling start.c with MSYS2/MinGW...

set MSYS2_PATH=C:\msys64\mingw64\bin
if not exist "%MSYS2_PATH%\gcc.exe" (
    set MSYS2_PATH=C:\msys64\ucrt64\bin
)
if not exist "%MSYS2_PATH%\gcc.exe" (
    echo ERROR: Cannot find gcc in MSYS2 paths
    echo Please ensure MSYS2 is installed at C:\msys64
    pause
    exit /b 1
)

set PATH=%MSYS2_PATH%;%PATH%

gcc -o doc/public/MarkingMaster.exe start.c ^
    -lwinhttp -lole32 -lshell32 ^
    -municode ^
    -static ^
    -O2

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful: doc\public\MarkingMaster.exe
    dir doc\public\MarkingMaster.exe
) else (
    echo.
    echo Build failed!
)

pause
