@echo off
echo Compiling start.c with MSYS2/MinGW...

if not exist secret.h (
    echo [ERROR] secret.h not found. Copy secret.h.example to secret.h and set ENCRYPTION_KEY.
    pause
    exit /b 1
)

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
    -I/mingw64/include ^
    -lwinhttp -lole32 -lshell32 -lminizip -lz -lbz2 -ladvapi32 ^
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
