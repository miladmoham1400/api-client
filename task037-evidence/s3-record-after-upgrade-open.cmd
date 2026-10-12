@echo off
rem TASK-037 helper: appends "after-upgrade-first-open-and-close" state to w-preservation-log.txt. Process-scoped policy bypass only for this local helper script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0record-state.ps1" -Label "after-upgrade-first-open-and-close"
echo Recorded "after-upgrade-first-open-and-close". This window closes in 5 seconds.
timeout /t 5 >nul
