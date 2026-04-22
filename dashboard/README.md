# Usage Dashboard Frontend

This frontend renders the local end-of-session dashboard for the usage tracker.

## Commands

```powershell
npm install
npm run build
npm run dev
```

## Notes

- `npm run build` writes the static site to `dashboard/dist/`
- the packaged app bundles the built assets and opens a self-contained dashboard snapshot from disk
- packaged snapshots are written under `%LOCALAPPDATA%\UsageTracker\state\dashboard-snapshots\`
- packaged same-day aggregation reads from `%LOCALAPPDATA%\UsageTracker\reports\`
