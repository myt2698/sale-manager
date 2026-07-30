param(
  [Parameter(Mandatory = $true)][int]$ProcessId,
  [Parameter(Mandatory = $true)][string]$SourcePath,
  [Parameter(Mandatory = $true)][string]$TargetPath
)

$expectedRoot = "D:\projects\sale-manager\app\release-ready\"
$resolvedSource = [System.IO.Path]::GetFullPath($SourcePath)
$resolvedTarget = [System.IO.Path]::GetFullPath($TargetPath)

if (
  -not $resolvedSource.StartsWith($expectedRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
  -not $resolvedTarget.StartsWith($expectedRoot, [System.StringComparison]::OrdinalIgnoreCase)
) {
  throw "Refusing paths outside release-ready"
}

Wait-Process -Id $ProcessId -ErrorAction SilentlyContinue

for ($attempt = 0; $attempt -lt 120; $attempt++) {
  try {
    [System.IO.File]::Copy($resolvedSource, $resolvedTarget, $true)
    [System.IO.File]::Delete($resolvedSource)
    exit 0
  } catch {
    Start-Sleep -Milliseconds 500
  }
}

exit 1
