param(
  [Parameter(Mandatory = $true)][int]$ProcessId,
  [Parameter(Mandatory = $true)][string]$SourceExe,
  [Parameter(Mandatory = $true)][string]$TargetExe
)

Wait-Process -Id $ProcessId -ErrorAction SilentlyContinue

$expectedHash = (Get-FileHash -LiteralPath $SourceExe -Algorithm SHA256).Hash
for ($attempt = 1; $attempt -le 600; $attempt++) {
  try {
    Copy-Item -LiteralPath $SourceExe -Destination $TargetExe -Force -ErrorAction Stop
    $actualHash = (Get-FileHash -LiteralPath $TargetExe -Algorithm SHA256).Hash
    if ($actualHash -eq $expectedHash) {
      exit 0
    }
  } catch {
    # Target may be locked if the app is reopened immediately; retry.
  }
  Start-Sleep -Seconds 1
}

exit 1
