@echo off
title Gmail Client

echo ================================
echo    Gmail Client Indítása
echo ================================
echo.

:: Server indítása új ablakban
start "Gmail Server" cmd /k "cd /d %~dp0server && npm run dev"

:: Várakozás a szerver indulására
echo Server indítása...
timeout /t 3 /nobreak >nul

:: Client indítása új ablakban
start "Gmail Client" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo ================================
echo   Mindkét szerver elindult!
echo ================================
echo.
echo Server:  http://localhost:5000
echo Client:  http://localhost:5173
echo.
echo Nyisd meg böngészőben: http://localhost:5173
echo.
echo Az ablakok bezárásával leállíthatod a szervereket.
echo.
pause
