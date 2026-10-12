# GateGuard Shared Types

Single source of truth for the TypeScript shapes used across `apps/api`,
`apps/web`, and `apps/mobile` — `VisitorEvent` and `VerificationRecord`.

## Current status

This package is **not yet wired into a real workspace dependency**. Each
app currently keeps its own matching copy of these types inline (in
`apps/web/src/App.tsx` and `apps/mobile/App.tsx`) rather than importing
from here directly — kept simple on purpose given the hackathon deadline.

`src/types.ts` is the canonical reference. If you change a field on the
API's `VerificationRecord`, update it here first, then copy the change
into the two apps' inline copies so all three stay in sync.

## If you want to wire it up for real

Turn this into an actual npm workspace package:

1. Add a `package.json` here with `"name": "@gateguard/shared"`
2. Add `"workspaces": ["apps/*", "packages/*"]` to the root `package.json`
3. Replace the inline type definitions in `apps/web` and `apps/mobile`
   with `import { VerificationRecord } from '@gateguard/shared'`

Not required for the hackathon submission — only worth doing if the
project continues past judging.