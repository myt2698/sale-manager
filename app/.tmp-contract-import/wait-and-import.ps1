param(
  [Parameter(Mandatory = $true)][int]$ProcessId,
  [Parameter(Mandatory = $true)][string]$NodePath,
  [Parameter(Mandatory = $true)][string]$ScriptPath,
  [Parameter(Mandatory = $true)][string]$WorkingDirectory
)

Wait-Process -Id $ProcessId -ErrorAction SilentlyContinue
Set-Location -LiteralPath $WorkingDirectory
& $NodePath $ScriptPath
