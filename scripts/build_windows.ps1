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
  $targetExecutablePaths = @(
    (Join-Path $repoRoot "dist\\UsageTrackerV1.exe"),
    (Join-Path $repoRoot "dist\\UsageTracker\\UsageTrackerV1.exe"),
    (Join-Path $repoRoot "dist\\UsageTracker\\UsageTracker.exe")
  ) | ForEach-Object {
    [System.IO.Path]::GetFullPath($_)
  }

  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -like "UsageTracker*.exe" -and
      $targetExecutablePaths -contains $_.ExecutablePath
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
The packaged app is still running and locking a generated executable.

Running process id(s): $processList

This usually happens because a previous packaged run is still open and locking the executable.

Close the running UsageTracker process first, or rerun the build with:

.\scripts\build_windows.ps1 -StopRunningApp
"@
}

function Remove-StaleOneFolderOutput {
  $repoRootPath = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
  $staleOutputPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "dist\\UsageTracker"))
  if (-not $staleOutputPath.StartsWith("$repoRootPath$([System.IO.Path]::DirectorySeparatorChar)", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove stale output outside the repo: $staleOutputPath"
  }

  if (-not (Test-Path -LiteralPath $staleOutputPath)) {
    return
  }

  Write-Host "Removing stale one-folder output: dist\UsageTracker"
  Remove-Item -LiteralPath $staleOutputPath -Recurse -Force
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
  Remove-StaleOneFolderOutput

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
  Write-Host "Executable: dist\UsageTrackerV1.exe"
  Write-Host "You can copy that single .exe to your Desktop and double-click it."
}
finally {
  Pop-Location
}
