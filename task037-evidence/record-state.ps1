# TASK-037 helper: records install state/version and SHA-256 of every file in the app's data folder (synthetic test data only).
param([string]$Label)
$log = Join-Path $PSScriptRoot 'w-preservation-log.txt'
$data = Join-Path $env:APPDATA 'offline-api-client'
$install = Join-Path $env:LOCALAPPDATA 'Programs\offline-api-client'
$exe = Join-Path $install 'offline-api-client.exe'
$lines = @("=== $Label | $(Get-Date -Format o) | user=$env:USERNAME ===")
$lines += "Installed app folder exists: $(Test-Path -LiteralPath $install)"
if (Test-Path -LiteralPath $exe) { $v = (Get-Item -LiteralPath $exe).VersionInfo; $lines += "Installed exe version: $($v.ProductVersion) / file $($v.FileVersion)" }
$lines += "App data folder exists: $(Test-Path -LiteralPath $data) ($data)"
$lines += "App processes running: $(@(Get-Process -Name 'offline-api-client' -ErrorAction SilentlyContinue).Count)"
if (Test-Path -LiteralPath $data) {
  Get-ChildItem -LiteralPath $data -Recurse -File -Force | Sort-Object FullName | ForEach-Object {
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName -ErrorAction SilentlyContinue).Hash
    if (-not $hash) { $hash = 'UNREADABLE' }
    $lines += ('{0}  {1,10}  {2}' -f $hash, $_.Length, $_.FullName.Substring($data.Length + 1))
  }
}
Get-ChildItem -Path (Join-Path $PSScriptRoot '..\dist\windows') -Filter '*-setup.exe' -ErrorAction SilentlyContinue | ForEach-Object { $lines += "Installer $($_.Name) SHA-256: $((Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash)" }
$lines += ''
$lines | Out-File -FilePath $log -Append -Encoding utf8
