# Windows App Usage Tracker

Simple Phase 1 MVP for Windows. It tracks the foreground desktop app, records idle time, saves readable JSON locally, and prints a short summary when you stop it.

## Run

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
py -3 main.py
```

Press `Ctrl+C` to stop tracking.

## Output

- JSON files are saved in `data/`
- Summary prints total time per app, total idle time, and the top 3 apps

## Dependencies

- No external packages
- Uses the Windows API through Python's built-in `ctypes` module
