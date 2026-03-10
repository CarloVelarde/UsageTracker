# Decisions

## Windows-specific assumptions

- This MVP is Windows-only and depends on Windows APIs exposed through Python's built-in `ctypes` module.
- Foreground app detection is based on the active desktop window, not background processes.
- Idle detection uses keyboard and mouse inactivity from `GetLastInputInfo`.

## Practical limitations

- Browser tabs and websites are not tracked in Phase 1. A browser will appear only as its desktop app, such as `chrome.exe` or `msedge.exe`.
- Some system windows, elevated apps, or unusual window types may return `Unknown` or an empty title if Windows does not expose their process details cleanly.
- Because the tracker polls every 2 seconds by default, very brief app switches can be missed.
- Idle time is recorded as its own session type so it does not get added into app totals.

## Design choices

- The implementation is intentionally small: one entry point plus one tracker module.
- Data is stored as indented JSON so it is easy to inspect for a class demo.
- On `Ctrl+C`, the tracker closes the current session first, then writes the JSON file, then prints the summary.
