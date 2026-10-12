@echo off
rem TASK-037 helper: appends "0.1.0-installed-baseline" state to w-preservation-log.txt. Process-scoped policy bypass only for this local helper script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0record-state.ps1" -Label "0.1.0-installed-baseline"
echo Recorded "0.1.0-installed-baseline". This window closes in 5 seconds.
timeout /t 5 >nul
