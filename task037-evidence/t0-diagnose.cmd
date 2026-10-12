@echo off
rem TASK-037 helper: diagnose why npm.cmd hangs inside the build helper. Read-only except its log.
set "LOG=%~dp0t0-diagnose-log.txt"
echo ==== %date% %time% ====> "%LOG%"
where node >> "%LOG%" 2>&1
where npm >> "%LOG%" 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(node|cmd|npm)' } | Select-Object ProcessId,ParentProcessId,Name,CommandLine | Format-List" >> "%LOG%" 2>&1
powershell -NoProfile -Command "$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/d /c npm.cmd --version' -NoNewWindow -PassThru -RedirectStandardOutput '%~dp0t0-npm-out.txt' -RedirectStandardError '%~dp0t0-npm-err.txt'; if ($p.WaitForExit(30000)) { 'npm exited ' + $p.ExitCode } else { 'npm TIMEOUT after 30s'; Stop-Process -Id $p.Id -Force }" >> "%LOG%" 2>&1
type "%~dp0t0-npm-out.txt" >> "%LOG%" 2>&1
type "%~dp0t0-npm-err.txt" >> "%LOG%" 2>&1
echo ==== done %time% ====>> "%LOG%"
