# TASK-037 helper: runs each step in its own cmd.exe process (npm.cmd cannot be called from a batch subroutine),
# (log path must not contain spaces) appending raw output and exit codes to a UTF-8 log. Stops at the first failing step unless -ContinueOnFailure.
param([string]$Log, [string]$StepsFile, [switch]$ContinueOnFailure)
$Steps = Get-Content -LiteralPath $StepsFile | Where-Object { $_.Trim() -ne '' -and -not $_.StartsWith('#') }
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
function Write-Log([string]$Text) { Add-Content -LiteralPath $Log -Value $Text -Encoding UTF8 }
Write-Log "==== start $(Get-Date -Format o) in $root ===="
$failed = $false
foreach ($step in $Steps) {
  Write-Log ''
  Write-Log ">>> $step [$(Get-Date -Format HH:mm:ss.fff)]"
  & cmd.exe /d /c "$step >> $Log 2>&1"
  $code = $LASTEXITCODE
  Write-Log "[exit code $code] [$(Get-Date -Format HH:mm:ss.fff)]"
  if ($code -ne 0) { $failed = $true; if (-not $ContinueOnFailure) { break } }
}
if ($failed) { Write-Log "==== FINISHED WITH FAILURE $(Get-Date -Format o) ====" } else { Write-Log "==== FINISHED OK $(Get-Date -Format o) ====" }
