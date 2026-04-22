# Decisions

## Windows-specific assumptions

- This MVP is Windows-only and depends on Windows APIs exposed through Python's built-in `ctypes` module.
- Foreground app detection is based on the active desktop window, not background processes.
- Idle detection uses keyboard and mouse inactivity from `GetLastInputInfo`.

## Dashboard decisions

- The dashboard opens from a self-contained local snapshot on disk after tracking stops.
- Daily summaries aggregate all JSON reports from the same calendar day.
- App names are normalized for display by removing `.exe` and applying simple title case.
- Time-based dashboard views use buckets to reduce noise from rapid app switching.
- The built dashboard assets are treated as static bundle content, while each snapshot embeds its own report payload.

## Practical limitations

- Browser tabs and websites are not tracked yet. A browser appears only as its desktop app, such as `chrome.exe` or `msedge.exe`.
- Some system windows, elevated apps, or unusual window types may return `Unknown` or an empty title if Windows does not expose their process details cleanly.
- Because the tracker polls every 2 seconds by default, very brief app switches can be missed.
- Idle time is recorded as its own session type so it does not get added into app totals.

## Design choices

- The Python side stays intentionally small: one entry point, one tracker module, and one dashboard launcher module.
- Data is stored as indented JSON so it is easy to inspect for analysis.
- On `Ctrl+C`, the tracker closes the current session, writes the JSON file, prints the summary, and opens the dashboard.
- Source-mode development keeps using repo-local paths.
- Packaged mode uses `%LOCALAPPDATA%\UsageTracker\reports\` for report files and `%LOCALAPPDATA%\UsageTracker\state\dashboard-snapshots\` for browser snapshots.
