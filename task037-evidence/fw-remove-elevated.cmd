@echo off
rem Runs elevated from %PUBLIC%. Removes the test-only rule added for TASK-037.
set "LOG=%PUBLIC%\task037-firewall-log.txt"
echo ==== REMOVE %date% %time% ====>> "%LOG%"
netsh advfirewall firewall delete rule name="TASK037-block-offline-api-client" >> "%LOG%" 2>&1
netsh advfirewall firewall show rule name="TASK037-block-offline-api-client" >> "%LOG%" 2>&1
