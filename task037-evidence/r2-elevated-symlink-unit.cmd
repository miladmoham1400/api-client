@echo off
rem TASK-037 helper: after a UAC prompt, runs tests/main/export.test.ts elevated (symlink creation needs elevation without Developer Mode). No system settings are changed.
powershell -NoProfile -Command "Start-Process -Verb RunAs -Wait -FilePath powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','%~dp0run-steps.ps1','-Log','%~dp0r2-elevated-unit-log.txt','-StepsFile','%~dp0r2-steps.txt','-ContinueOnFailure'"
echo Elevated unit helper finished; see r2-elevated-unit-log.txt. This window closes in 10 seconds.
timeout /t 10 >nul
