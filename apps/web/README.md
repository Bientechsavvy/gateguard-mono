# GateGuard Web Dashboard

The diaspora approval dashboard — the primary demo surface for GateGuard.
A family member abroad (or an on-site manager) opens this page to see live
visitor events, CALL-E's verification result, Bedrock's second opinion,
and approve or deny access from anywhere.

## What it does

- Polls the API every 4 seconds for verification events
- Shows each visitor's stated name, stated purpose, and whether either
  CALL-E or Bedrock flagged the call as suspicious
- Lets you Approve or Deny directly from the browser
- Shows an "unreachable" state when a visitor couldn't be called and the
  gateman is handling it on-site (offline-first fallback)

## Setup

```bash
npm install
```

Create a `.env` file in this folder (not committed) with:
VITE_API_BASE_URL=http://localhost:3000
VITE_API_KEY=changeme_dev_only


`VITE_API_KEY` must match `DASHBOARD_API_KEY` in `apps/api/.env` — every
request to the API requires it.

## Run it

```bash
npm run dev
```

Opens at `http://localhost:5173` by default. The API (`apps/api`) must
already be running for the dashboard to show anything.

## Build for deployment

```bash
npm run build
```

Outputs static files to `dist/` — this is what gets copied to
`/var/www/gateguard-web` on the EC2 instance and served by Nginx.

## Notes

- No routing library, no state management library — kept deliberately
  simple for the hackathon timeline. `src/App.tsx` is the entire app.
- Styling is plain CSS (`src/styles.css`), no framework overhead.
- If the dashboard shows nothing but the API is running, check the browser
  console for a 401 — that means `VITE_API_KEY` doesn't match the API's
  `DASHBOARD_API_KEY`.