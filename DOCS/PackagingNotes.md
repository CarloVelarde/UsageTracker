# Packaging Notes

This document tracks the packaging-oriented runtime changes for the Windows usage tracker.

## Current Status

- Step 1 is implemented: writable runtime data paths are packaging-safe.
- Step 2 is implemented: dashboard asset loading is packaging-safe.
- Milestone 1 behavior is still the same console-driven tracker flow.

## Runtime Paths

- In source mode, the app continues to use repo-local paths for writable data.
- In packaged mode, writable runtime data is intended to live under `%LOCALAPPDATA%\UsageTracker\`.
- Reports are written to the runtime `data/` directory.
- Dashboard runtime state is written to the runtime `state/` directory.

## Dashboard Serving Model

- The React frontend is still built ahead of time into `dashboard/dist/`.
- The built frontend assets are treated as static bundle content.
- The latest report payload is no longer written into `dashboard/dist/report-data.js`.
- Instead, the app writes the latest dashboard payload to a writable runtime state file and serves that file at `/report-data.js`.

## Why This Matters For Packaging

- Bundled frontend assets may be read-only or ephemeral in a packaged app.
- Runtime reports and dashboard payloads still need to change on every run.
- Splitting static assets from writable runtime state makes the app much safer to freeze with PyInstaller.

## Remaining Packaging Work

- Add the PyInstaller build setup.
- Bundle the built dashboard assets into the packaged application.
- Verify the packaged console workflow end to end on a clean Windows machine.
