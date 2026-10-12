@echo off
rem TASK-037 helper: native Windows build from this checkout. Each command and exit code is logged to w1-build-log.txt.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-steps.ps1" -Log "%~dp0w1-build-log.txt" -StepsFile "%~dp0w1-steps.txt"
echo Build helper finished; see w1-build-log.txt. This window closes in 10 seconds.
timeout /t 10 >nul
