# TASK-029 helper: records install state and SHA-256 of every file in the app's data folder (synthetic test data only).
param([string]$Label)
$log = Join-Path $PSScriptRoot '4-preservation-log.txt'
$data = Join-Path $env:APPDATA 'offline-api-client'
$install = Join-Path $env:LOCALAPPDATA 'Programs\offline-api-client'
$lines = @("=== $Label | $(Get-Date -Format o) | user=$env:USERNAME ===")
$lines += "Installed app folder exists: $(Test-Path -LiteralPath $install)"
$lines += "App data folder exists: $(Test-Path -LiteralPath $data) ($data)"
$lines += "App processes running: $(@(Get-Process -Name 'offline-api-client' -ErrorAction SilentlyContinue).Count)"
if (Test-Path -LiteralPath $data) {
  Get-ChildItem -LiteralPath $data -Recurse -File -Force | Sort-Object FullName | ForEach-Object {
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName -ErrorAction SilentlyContinue).Hash
    if (-not $hash) { $hash = 'UNREADABLE' }
    $lines += ('{0}  {1,10}  {2}' -f $hash, $_.Length, $_.FullName.Substring($data.Length + 1))
  }
}
$installer = Join-Path $PSScriptRoot '..\dist\windows\offline-api-client-0.1.0-x64-setup.exe'
if (Test-Path -LiteralPath $installer) { $lines += "Installer SHA-256: $((Get-FileHash -Algorithm SHA256 -LiteralPath $installer).Hash)" }
$lines += ''
$lines | Out-File -FilePath $log -Append -Encoding utf8
