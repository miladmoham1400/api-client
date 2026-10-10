@echo off
rem Runs elevated from %PUBLIC%. Adds a test-only outbound block rule for the installed app.
set "LOG=%PUBLIC%\task029-firewall-log.txt"
echo ==== ADD %date% %time% ====>> "%LOG%"
netsh advfirewall firewall add rule name="TASK029-block-offline-api-client" dir=out action=block program="C:\Users\javad\AppData\Local\Programs\offline-api-client\offline-api-client.exe" enable=yes profile=any >> "%LOG%" 2>&1
netsh advfirewall firewall show rule name="TASK029-block-offline-api-client" verbose >> "%LOG%" 2>&1
netsh advfirewall show allprofiles state >> "%LOG%" 2>&1
