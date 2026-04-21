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
- the Python tracker writes the latest report into `dashboard/dist/report-data.js`
- opening `dashboard/dist/index.html` shows the newest locally generated summary
