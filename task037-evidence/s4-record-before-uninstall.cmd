@echo off
rem TASK-037 helper: appends "before-uninstall" state to w-preservation-log.txt. Process-scoped policy bypass only for this local helper script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0record-state.ps1" -Label "before-uninstall"
echo Recorded "before-uninstall". This window closes in 5 seconds.
timeout /t 5 >nul
