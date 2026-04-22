# Windows App Usage Tracker

Windows only local usage tracker with a browser dashboard. It records foreground apps, idle time, saves local JSON reports, and opens a same day dashboard when tracking stops.

## Run

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd dashboard
npm install
npm run build
cd ..
py -3 main.py
```

Press `Ctrl+C` to stop tracking.

## Output

- JSON files are saved in `data/` during source-mode development
- packaged builds are intended to save runtime files under `%LOCALAPPDATA%\UsageTracker\`
- Summary prints total time per app, total idle time, and the top 3 apps
- The dashboard opens at `http://127.0.0.1:8765/`
- The dashboard aggregates all runs from the same day

## Milestone 1 UX

- users run the executable to start tracking
- the console window stays open while tracking is active
- `Ctrl+C` is the official stop action
- on Windows, closing the console window also attempts a graceful shutdown so the report can still be saved and the dashboard opened
- stopping the tracker saves the session data, prints a summary, and opens the dashboard

## Packaging Notes

- runtime path handling is now packaging-safe for report data and dashboard state
- the built dashboard assets can be bundled separately from writable runtime files
- the latest dashboard payload is served from a runtime state file instead of rewriting bundled frontend assets
- milestone 1 still keeps the console-driven tracker flow

See [DOCS/PackagingNotes.md](/C:/Users/Carlo/Documents/Playground/DOCS/PackagingNotes.md) for the current packaging-focused implementation notes.

## Dependencies

- Python tracker uses only the standard library and Windows APIs through `ctypes`
- Dashboard frontend uses React, Vite, Recharts, and Motion
