@echo off
rem Runs elevated from %PUBLIC%. Removes the test-only rule added for TASK-029.
set "LOG=%PUBLIC%\task029-firewall-log.txt"
echo ==== REMOVE %date% %time% ====>> "%LOG%"
netsh advfirewall firewall delete rule name="TASK029-block-offline-api-client" >> "%LOG%" 2>&1
netsh advfirewall firewall show rule name="TASK029-block-offline-api-client" >> "%LOG%" 2>&1
