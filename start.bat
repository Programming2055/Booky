@echo off
title Booky App
echo ================================
echo        Booky App Starter
echo ================================
echo.

REM Check for Python
where python >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [1/2] Starting Python ebook server...
    start "Python Server" /min python server/ebook_server.py
    echo       Python server started in background
) else (
    echo [1/2] Python not found - DJVU/PDF system app features disabled
)

echo.
echo [2/2] Starting React dev server...
echo.
npm run dev

echo.
echo Goodbye!
pause
