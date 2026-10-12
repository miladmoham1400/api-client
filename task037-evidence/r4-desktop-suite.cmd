@echo off
rem TASK-037 helper: full Playwright desktop suite plus 5x guard/Ctrl+S repeats against the INSTALLED fixed build (isolated temporary profiles).
set "API_CLIENT_EXECUTABLE=%LOCALAPPDATA%\Programs\offline-api-client\offline-api-client.exe"
set "API_CLIENT_PERFORMANCE_REPORT=%~dp0r4-windows-performance.json"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-steps.ps1" -Log "%~dp0r4-desktop-suite-log.txt" -StepsFile "%~dp0r4-steps.txt" -ContinueOnFailure
echo Suite helper finished; see r4-desktop-suite-log.txt. This window closes in 10 seconds.
timeout /t 10 >nul
