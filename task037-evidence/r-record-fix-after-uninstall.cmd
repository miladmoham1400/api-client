@echo off
rem TASK-037 helper: appends "fix-after-uninstall" state to w-preservation-log.txt.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0record-state.ps1" -Label "fix-after-uninstall"
echo Recorded "fix-after-uninstall". This window closes in 5 seconds.
timeout /t 5 >nul
