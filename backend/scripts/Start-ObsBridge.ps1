param([string]$ConfigPath = (Join-Path $PSScriptRoot '..\.obs-bridge.json'))
$ErrorActionPreference = 'Stop'
$bridgeConfig = (Resolve-Path -LiteralPath $ConfigPath).Path
$bridgeDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$bridgeProcess = Start-Process -FilePath $nodeExecutable -ArgumentList @('scripts/obsBridge.js', '--config', ('"{0}"' -f $bridgeConfig)) -WorkingDirectory $bridgeDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $bridgeDirectory 'obs-bridge.log') -RedirectStandardError (Join-Path $bridgeDirectory 'obs-bridge.error.log') -PassThru
Write-Output "Puente iniciado en segundo plano (PID $($bridgeProcess.Id)). Consulta obs-bridge.log."
