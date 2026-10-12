@echo off
rem TASK-037 helper: focused rerun of the failing guard specs against the INSTALLED app.
set "API_CLIENT_EXECUTABLE=%LOCALAPPDATA%\Programs\offline-api-client\offline-api-client.exe"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-steps.ps1" -Log "%~dp0w4-guard-rerun-log.txt" -StepsFile "%~dp0w4-steps.txt" -ContinueOnFailure
echo Rerun helper finished; see w4-guard-rerun-log.txt. This window closes in 10 seconds.
timeout /t 10 >nul
