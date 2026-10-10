@echo off
rem TASK-029 helper. Copies the elevated step to %PUBLIC% (visible to the elevated session), runs it after a UAC prompt, then copies the log back here.
copy /y "%~dp0fw-add-elevated.cmd" "%PUBLIC%\task029-fw-add.cmd" >nul
powershell -NoProfile -Command "Start-Process -Verb RunAs -Wait -FilePath (Join-Path $env:PUBLIC 'task029-fw-add.cmd')"
copy /y "%PUBLIC%\task029-firewall-log.txt" "%~dp0a-firewall-log.txt" >nul
del "%PUBLIC%\task029-fw-add.cmd" >nul 2>&1
echo Firewall step "add" finished. This window closes in 5 seconds.
timeout /t 5 >nul
