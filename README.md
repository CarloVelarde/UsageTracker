# Windows App Usage Tracker

Simple Phase 1 MVP for Windows. It tracks the foreground desktop app, records idle time, saves readable JSON locally, and prints a short summary when you stop it.

Phase 2 now adds a local React dashboard that opens in your browser when tracking ends.

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

- JSON files are saved in `data/`
- Summary prints total time per app, total idle time, and the top 3 apps
- A polished local dashboard opens from `dashboard/dist/index.html`

## Dependencies

- No external packages
- Uses the Windows API through Python's built-in `ctypes` module
- Dashboard frontend uses React + Vite + Recharts + Motion
