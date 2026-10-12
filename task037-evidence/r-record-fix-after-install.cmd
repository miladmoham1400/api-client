@echo off
rem TASK-037 helper: appends "fix-after-install" state to w-preservation-log.txt.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0record-state.ps1" -Label "fix-after-install"
echo Recorded "fix-after-install". This window closes in 5 seconds.
timeout /t 5 >nul
