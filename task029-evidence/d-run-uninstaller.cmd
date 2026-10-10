@echo off
rem TASK-029 helper: runs the app's own uninstaller in place (NSIS _?= waits for completion) and logs the exit code and remaining files.
set "DIR=%LOCALAPPDATA%\Programs\offline-api-client"
set "LOG=%~dp0d-uninstaller-log.txt"
echo ==== %date% %time% ====>> "%LOG%"
echo Before:>> "%LOG%"
dir /b /a "%DIR%" >> "%LOG%" 2>&1
tasklist /fi "imagename eq offline-api-client.exe" >> "%LOG%" 2>&1
for %%F in ("%DIR%\Uninstall*.exe") do (
  echo Running: "%%~fF" _?=%DIR%>> "%LOG%"
  "%%~fF" _?=%DIR%
)
echo Exit code: %errorlevel%>> "%LOG%"
echo After:>> "%LOG%"
dir /b /a "%DIR%" >> "%LOG%" 2>&1
echo Done. This window closes in 5 seconds.
timeout /t 5 >nul
