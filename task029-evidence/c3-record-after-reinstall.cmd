@echo off
rem TASK-029 helper: appends "after-reinstall-and-reopen" state to 4-preservation-log.txt. Process-scoped policy bypass only for this local helper script.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0record-state.ps1" -Label "after-reinstall-and-reopen"
echo Recorded "after-reinstall-and-reopen". This window closes in 5 seconds.
timeout /t 5 >nul
