# Windows App Usage Tracker

Windows only local usage tracker with a browser dashboard. It records foreground apps and idle time, saves local JSON reports, and opens a same-day dashboard when tracking stops.

## Repo Layout

- `usage_tracker/`: Python application package and entrypoint
- `dashboard/`: React frontend
- `data/`: development-mode report output
- `scripts/`: local build scripts
- `packaging/`: PyInstaller spec
- `DOCS/`: short project docs
- generated output is kept out of the repo: `dashboard/dist/`, `build/`, and `dist/`

## Prerequisites

- Python on `PATH`
- Node.js and `npm` on `PATH`

You only need Node.js for development and packaging. End users running the packaged executable do not need Python or Node.

## Run In Development

Use this when you are changing Python code or frontend code.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cd dashboard
npm install
npm run build
cd ..
python -m usage_tracker
```

- Keep the console window open while tracking.
- Press `Ctrl+C` to stop.
- On stop, the app saves the report, prints a summary, and opens the dashboard.
- Development reports are saved in `data/`.

## Run The Packaged Executable

Use this when you just want to track locally without setting up Python or Node.

```powershell
dist\UsageTracker.exe
```

- The console window stays open while tracking is active.
- Press `Ctrl+C` to stop.
- Closing the console window also attempts a graceful shutdown.
- Packaged runtime files are saved under `%LOCALAPPDATA%\UsageTracker\`.
- Packaged JSON reports are saved under `%LOCALAPPDATA%\UsageTracker\reports\`.
- Each packaged dashboard snapshot also keeps its own `report.json` copy under `%LOCALAPPDATA%\UsageTracker\state\dashboard-snapshots\`.
- Packaged same-day aggregation reads from `reports/` only. The old `data/` folder is no longer used by the executable.
- When tracking stops, the app opens a local dashboard snapshot in your browser and then exits. It does not keep a background `UsageTracker.exe` running.
- `dist\UsageTracker.exe` is a single-file executable. You can copy that file to your Desktop and double-click it, or manually archive it under `releases\UsageTrackerV1\UsageTrackerV1.exe`.

## Rebuild The Executable

Use this after changing Python code, frontend code, or packaging files.

```powershell
.\scripts\build_windows.ps1
```

Faster rebuild if your build dependencies are already installed:

```powershell
.\scripts\build_windows.ps1 -SkipDependencyInstall
```

This script:

- installs or refreshes PyInstaller for the builder Python environment
- builds the React dashboard into `dashboard/dist/`
- writes a single-file executable to `dist\UsageTracker.exe`

The latest build output is the single `dist\UsageTracker.exe` file.

## Notes

- The dashboard aggregates all runs from the same day.
- The dashboard always includes the run that just ended, even before older same-day files are aggregated in.
- The dashboard opens from a local snapshot on disk after tracking stops, so stopping tracking also ends the `UsageTracker.exe` process.
- For packaging details, see [DOCS/BuildAndPackage.md](/C:/Users/Carlo/Documents/Playground/DOCS/BuildAndPackage.md).
