@echo off
rem TASK-037 helper: full Playwright desktop suite against the INSTALLED app (isolated temporary profiles), with performance report.
set "API_CLIENT_EXECUTABLE=%LOCALAPPDATA%\Programs\offline-api-client\offline-api-client.exe"
set "API_CLIENT_PERFORMANCE_REPORT=%~dp0w3-windows-performance.json"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-steps.ps1" -Log "%~dp0w3-desktop-suite-log.txt" -StepsFile "%~dp0w3-steps.txt" -ContinueOnFailure
echo Suite helper finished; see w3-desktop-suite-log.txt. This window closes in 10 seconds.
timeout /t 10 >nul
