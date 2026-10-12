@echo off
rem TASK-037 helper: native Windows packaging and hash. Each command and exit code is logged to w1b-package-log.txt.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-steps.ps1" -Log "%~dp0w1b-package-log.txt" -StepsFile "%~dp0w1b-steps.txt"
echo Package helper finished; see w1b-package-log.txt. This window closes in 10 seconds.
timeout /t 10 >nul
