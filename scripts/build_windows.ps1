param(
  [switch]$SkipDependencyInstall,
  [switch]$StopRunningApp
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

function Require-Command {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $command = Get-Command $Name -ErrorAction Stop
  return $command.Source
}

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & $FilePath @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
  }
}

function Get-RunningUsageTrackerProcesses {
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -eq "UsageTracker.exe" -and
      $_.ExecutablePath -eq (Join-Path $repoRoot "dist\\UsageTracker\\UsageTracker.exe")
    }
}

function Assert-PackagedAppNotRunning {
  $runningProcesses = @(Get-RunningUsageTrackerProcesses)
  if ($runningProcesses.Count -eq 0) {
    return
  }

  if ($StopRunningApp) {
    $runningProcesses | ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force
    }
    Start-Sleep -Seconds 1
    return
  }

  $processList = ($runningProcesses | ForEach-Object { "$($_.ProcessId)" }) -join ", "
  throw @"
The packaged app is still running and locking dist\UsageTracker\UsageTracker.exe.

Running process id(s): $processList

This usually happens because a previous packaged run is still open and locking the executable.

Close the running UsageTracker process first, or rerun the build with:

.\scripts\build_windows.ps1 -StopRunningApp
"@
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$pythonExe = Require-Command -Name "python"
$npmExe = Require-Command -Name "npm"

Write-Host "Packaging UsageTracker from $repoRoot"
Write-Host "Python: $pythonExe"
Write-Host "npm: $npmExe"

Push-Location $repoRoot

try {
  Assert-PackagedAppNotRunning

  if (-not $SkipDependencyInstall) {
    Write-Host "Installing or refreshing build dependencies..."
    Invoke-NativeCommand $pythonExe -m pip install --upgrade pyinstaller

    Push-Location (Join-Path $repoRoot "dashboard")
    try {
      Invoke-NativeCommand $npmExe ci
    }
    finally {
      Pop-Location
    }
  }

  Push-Location (Join-Path $repoRoot "dashboard")
  try {
    Write-Host "Building React dashboard..."
    Invoke-NativeCommand $npmExe run build
  }
  finally {
    Pop-Location
  }

  Write-Host "Building PyInstaller package..."
  Invoke-NativeCommand $pythonExe -m PyInstaller ".\packaging\usage_tracker.spec" --noconfirm --clean

  Write-Host ""
  Write-Host "Build complete."
  Write-Host "Executable: dist\UsageTracker\UsageTracker.exe"
  Write-Host "Share the full dist\UsageTracker folder for milestone 1."
}
finally {
  Pop-Location
}
