@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0lancer-teskerti.ps1" -Stop
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo L'arret de Teskerti a echoue. Consultez le message ci-dessus.
)
pause
exit /b %EXIT_CODE%
