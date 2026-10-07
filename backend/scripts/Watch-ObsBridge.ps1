param(
  [Parameter(Mandatory=$true)][string]$ConfigPath,
  [Parameter(Mandatory=$true)][string]$NodePath
)
$ErrorActionPreference = 'Stop'
$bridgeDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$bridgeConfig = (Resolve-Path -LiteralPath $ConfigPath).Path
# One supervisor per project. The bridge also keeps its own process lock.
$hashProvider = [System.Security.Cryptography.SHA256]::Create()
try { $projectHash = [BitConverter]::ToString($hashProvider.ComputeHash([Text.Encoding]::UTF8.GetBytes($bridgeDirectory.ToLowerInvariant()))).Replace('-', '') }
finally { $hashProvider.Dispose() }
$supervisorMutex = New-Object System.Threading.Mutex($false, ('Local\ObsOverlayBridge-' + $projectHash))
$ownsMutex = $false
try {
  try { $ownsMutex = $supervisorMutex.WaitOne(0) }
  catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
  if (-not $ownsMutex) { exit 0 }
  while ($true) {
    $bridgeProcess = Start-Process -FilePath $NodePath -ArgumentList @('scripts/obsBridge.js', '--config', ('"{0}"' -f $bridgeConfig)) -WorkingDirectory $bridgeDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $bridgeDirectory 'obs-bridge.log') -RedirectStandardError (Join-Path $bridgeDirectory 'obs-bridge.error.log') -PassThru
    $bridgeProcess.WaitForExit()
    # Network/OBS retries run inside the bridge. Restart only after process exit.
    Start-Sleep -Seconds 10
  }
}
finally {
  if ($ownsMutex) { $supervisorMutex.ReleaseMutex() }
  $supervisorMutex.Dispose()
}
