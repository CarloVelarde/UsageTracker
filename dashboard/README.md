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
- the packaged app can bundle the built dashboard assets and serve the latest report data from a separate writable runtime file
- the app serves the dashboard locally at `http://127.0.0.1:8765/`
- the dashboard view aggregates all runs from the same day
