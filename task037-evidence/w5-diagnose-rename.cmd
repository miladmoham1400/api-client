@echo off
rem TASK-037 helper: diagnostic probe (not acceptance evidence) against the INSTALLED app.
set "API_CLIENT_EXECUTABLE=%LOCALAPPDATA%\Programs\offline-api-client\offline-api-client.exe"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-steps.ps1" -Log "%~dp0w5-diagnose-log.txt" -StepsFile "%~dp0w5-steps.txt" -ContinueOnFailure
echo Diagnostic finished; see w5-diagnose-log.txt. This window closes in 10 seconds.
timeout /t 10 >nul
