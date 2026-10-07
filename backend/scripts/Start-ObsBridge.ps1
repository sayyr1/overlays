param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot '..\.obs-bridge.json'),
  [switch]$AutoStart
)
$ErrorActionPreference = 'Stop'
$bridgeConfig = (Resolve-Path -LiteralPath $ConfigPath).Path
$bridgeDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$watchScript = Join-Path $PSScriptRoot 'Watch-ObsBridge.ps1'
$powerShellExecutable = Join-Path $PSHOME 'powershell.exe'
$watchArguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -ConfigPath "{1}" -NodePath "{2}"' -f $watchScript, $bridgeConfig, $nodeExecutable
if ($AutoStart) {
  $startupDirectory = [Environment]::GetFolderPath('Startup')
  $shortcutShell = New-Object -ComObject WScript.Shell
  $shortcut = $shortcutShell.CreateShortcut((Join-Path $startupDirectory 'OBS Overlay Bridge.lnk'))
  $shortcut.TargetPath = $powerShellExecutable
  $shortcut.Arguments = $watchArguments
  $shortcut.WorkingDirectory = $bridgeDirectory
  $shortcut.WindowStyle = 7
  $shortcut.Save()
  Write-Output 'Inicio automatico del puente configurado para esta cuenta de Windows.'
}
$bridgeProcess = Start-Process -FilePath $powerShellExecutable -ArgumentList $watchArguments -WorkingDirectory $bridgeDirectory -WindowStyle Hidden -PassThru
Write-Output "Supervisor del puente iniciado (PID $($bridgeProcess.Id)). Consulta obs-bridge.log."
