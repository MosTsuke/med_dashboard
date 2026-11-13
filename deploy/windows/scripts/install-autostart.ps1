# Registers the "MedDashboard" scheduled task: starts the dashboard when the
# PC boots (as SYSTEM, so nobody has to log in), starts it again a minute
# after it stops, and has no 3-day run limit. Called by
# 2-install-autostart.bat (as administrator). ASCII only: Windows
# PowerShell 5.1 misreads UTF-8 scripts without a BOM.
param([Parameter(Mandatory = $true)][string]$Root)
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path $Root).Path
$runner = Join-Path $Root 'scripts\run-dashboard.cmd'
if (-not (Test-Path $runner)) { throw "Not found: $runner" }

# cmd /c ""C:\...\run-dashboard.cmd" log" - cmd strips the outer quotes.
$action = New-ScheduledTaskAction -Execute 'cmd.exe' `
  -Argument ('/c ""' + $runner + '" log"') -WorkingDirectory $Root
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT30S'
$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName 'MedDashboard' `
  -Description ('Med Dashboard (CSSD statistics). Folder: ' + $Root) `
  -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'MedDashboard'
Write-Host 'Scheduled task MedDashboard registered and started.'
