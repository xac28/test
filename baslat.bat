@echo off
chcp 65001 >nul
title AYA - kurulum ve baslatma
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-setup.ps1"
echo.
pause
