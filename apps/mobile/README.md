# GateGuard Mobile — Gate Companion

A lightweight React Native (Expo) app for the gateman on-site — built for
the caretaking/accessibility angle of the Ring track: someone without a
laptop, using their phone at the gate.

**Status: stretch goal.** Build this only after `apps/api` and `apps/web`
are working end-to-end. A strong web demo plus a real Ring integration
beats three half-finished apps.

## What it does

- Shows visitors currently awaiting a decision, or flagged as
  "unreachable" (offline fallback — call couldn't connect)
- Lets the gateman tap "Let in" or "Turn away" directly from their phone
- Pull-to-refresh to manually reload the queue

## Setup

```bash
npm install
```

## Run it

Set the API address as an environment variable before starting — use your
computer's **LAN IP**, not `localhost`, if testing on a physical phone
(on a phone, `localhost` means the phone itself, not your PC):

```bash
export EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:3000
export EXPO_PUBLIC_API_KEY=changeme_dev_only
npm start
```

Find your LAN IP on Windows with `ipconfig` (look for "IPv4 Address") in a
plain terminal, not Git Bash.

This opens Expo's dev tools with a QR code:

- **Scan it with the Expo Go app** on your phone (fastest way to test on
  a real device)
- **Or press `w`** in the terminal to run it in a browser instead — no
  phone needed, good for quick checks

## Notes

- Written in TypeScript (`App.tsx`) — see `tsconfig.json`.
- `EXPO_PUBLIC_API_KEY` must match `DASHBOARD_API_KEY` in `apps/api/.env`.
- This app is not meant to be published to an app store for the
  hackathon — it just needs to run in Expo Go or the simulator for the
  demo video.