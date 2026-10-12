@echo off
rem TASK-037 helper: rebuilds the Windows installer from the fixed source and runs type/lint/unit checks.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-steps.ps1" -Log "%~dp0r1-build-log.txt" -StepsFile "%~dp0r1-steps.txt" -ContinueOnFailure
echo Build helper finished; see r1-build-log.txt. This window closes in 10 seconds.
timeout /t 10 >nul
