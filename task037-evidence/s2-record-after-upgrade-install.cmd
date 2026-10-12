@echo off
rem TASK-037 helper: appends "after-upgrade-install-before-open" state to w-preservation-log.txt. Process-scoped policy bypass only for this local helper script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0record-state.ps1" -Label "after-upgrade-install-before-open"
echo Recorded "after-upgrade-install-before-open". This window closes in 5 seconds.
timeout /t 5 >nul
