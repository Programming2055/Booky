@echo off
REM Booky Installer Build Script (Batch version)
REM Run from the installer directory

echo ============================================
echo        Booky Installer Build Script
echo ============================================
echo.

REM Set directories
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set DIST_DIR=%PROJECT_ROOT%\dist
set OUTPUT_DIR=%SCRIPT_DIR%output

REM Create output directory
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Step 1: Build React app
echo [1/3] Building React application...
cd /d "%PROJECT_ROOT%"
if not exist "node_modules" (
    echo      Installing npm dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
)

echo      Running npm build...
call npm run build
if errorlevel 1 (
    echo ERROR: npm build failed
    pause
    exit /b 1
)
echo      React app built successfully
echo.

REM Step 2: Build executable with PyInstaller
echo [2/3] Building executable with PyInstaller...
cd /d "%SCRIPT_DIR%"

REM Check if PyInstaller is available
where pyinstaller >nul 2>&1
if errorlevel 1 (
    echo      Installing PyInstaller...
    pip install pyinstaller
    if errorlevel 1 (
        echo ERROR: Failed to install PyInstaller
        pause
        exit /b 1
    )
)

REM Clean previous build
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"

echo      Running PyInstaller...
pyinstaller booky.spec --clean
if errorlevel 1 (
    echo ERROR: PyInstaller build failed
    pause
    exit /b 1
)

if not exist "dist\Booky.exe" (
    echo ERROR: Executable not created
    pause
    exit /b 1
)
echo      Executable built successfully
echo.

REM Step 3: Build installer with Inno Setup
echo [3/3] Building installer with Inno Setup...

REM Find Inno Setup
set ISCC=
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
) else if exist "C:\Program Files\Inno Setup 6\ISCC.exe" (
    set "ISCC=C:\Program Files\Inno Setup 6\ISCC.exe"
)

if "%ISCC%"=="" (
    echo ERROR: Inno Setup not found!
    echo Please install from: https://jrsoftware.org/isdl.php
    pause
    exit /b 1
)

echo      Using: %ISCC%
"%ISCC%" booky.iss
if errorlevel 1 (
    echo ERROR: Inno Setup compilation failed
    pause
    exit /b 1
)

echo.
echo ============================================
echo           Build Complete!
echo ============================================
echo.
echo Installer created in: %OUTPUT_DIR%
echo.
pause
