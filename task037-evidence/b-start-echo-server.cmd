@echo off
rem TASK-037 helper: loopback-only synthetic test server for manual checks. Close this window to stop it.
title TASK-037 echo server
node "%~dp0echo-server.mjs"
pause
