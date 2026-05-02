# Build And Package

This project now includes a repeatable Windows packaging script for milestone 1.

## Builder Prerequisites

- Windows
- Python available on `PATH` as `python`
- Node.js and `npm` available on `PATH`

End users do not need Python or Node. These are only required on the machine that builds the package.

## How To Run It

From the repo root in PowerShell:

```powershell
.\scripts\build_windows.ps1
```

If you already installed the build dependencies and want a quicker rebuild:

```powershell
.\scripts\build_windows.ps1 -SkipDependencyInstall
```

## What The Script Does

1. Finds `python` and `npm` on the current machine.
2. Installs or refreshes PyInstaller for the builder Python environment.
3. Runs `npm ci` in `dashboard/` so the frontend dependencies match `package-lock.json`.
4. Runs `npm run build` to create the production React frontend in `dashboard/dist/`.
5. Runs PyInstaller with `packaging/usage_tracker.spec` to create a Windows console executable.
6. Writes the packaged output to `dist/UsageTrackerV1.exe`.

If any build step fails, the script now stops immediately and surfaces the failing command instead of printing a misleading success message.

## Output

- main executable: `dist/UsageTrackerV1.exe`
- shareable milestone-1 deliverable: the single `dist/UsageTrackerV1.exe` file
- packaged runtime reports: `%LOCALAPPDATA%\UsageTracker\reports\`
- packaged dashboard snapshots: `%LOCALAPPDATA%\UsageTracker\state\dashboard-snapshots\`
- `build/`, `dist/`, and `dashboard/dist/` are generated output and should not be committed

The package is a single-file build so the executable can be copied to the Desktop and run by double-clicking it.
