@echo off
echo Szerverek leállítása...
taskkill /f /im node.exe 2>nul
echo Kész!
pause
