# GateGuard

AI-powered visitor and delivery verification for gated compounds and small
businesses in Nigeria and Benin Republic. Built for the **Ring** track of
the Amazon Developer Hackathon (Build, Ship, Shape 2026), with an
**AWS Builder** mini-challenge integration via Amazon Bedrock.

## Structure

```
gateguard-mono/
├── apps/
│   ├── api/      NestJS — Ring trigger, Twilio call, Bedrock flag, decisions
│   ├── web/      ReactJS — diaspora approval dashboard (PRIMARY demo surface)
│   └── mobile/   React Native/Expo, TypeScript — gateman on-site companion (stretch)
└── packages/
    └── shared/   Shared TypeScript types (VisitorEvent, VerificationRecord)
```

## Calling engine

`apps/api/src/gate-verification` calls [CALL-E](https://www.heycall-e.com)
to place the actual verification call — this is the same calling engine
built and shipped for DispatchCheck/CALL-E, carried over and adapted for
gate verification rather than reimplemented from scratch. Amazon Bedrock
then reviews CALL-E's call summary independently as a second opinion
before anything reaches the dashboard. Defaults to `CALLE_MODE=dry_run`
(no real calls placed) so the whole pipeline is safe to test locally —
see `apps/api/README.md` for enabling live calls.

## Why this split

- **api** is the engine — this is what's scored hardest on Tech
  Implementation and is what makes the Ring, CALL-E, and Bedrock
  integrations real, not decorative.
- **web** is the app judges actually click through in under 3 minutes —
  no app store, no simulator setup on their end. This carries your demo.
- **mobile** exists to show the caretaking/accessibility story (a gateman
  without a laptop, using their phone) — build it *after* api + web are
  solid and demo-able, not in parallel with them.

## Build order (given the Oct 23 deadline)

1. **api** — done. Test locally with the curl commands in `apps/api/README.md`.
2. **web** — wire it to the running api, confirm the approve/deny loop
   works live.
3. **Ring integration** — swap your curl test for a real Ring
   simulator/webhook event. This is the Stage 1 pass/fail gate — don't
   skip or shortcut it.
4. **mobile** — only once 1–3 are working end-to-end. If time is short,
   it is the piece to cut or leave partially built; a strong web demo
   plus a real Ring hook beats three half-finished apps.
5. Record the 3-minute demo video, write the product feedback, add the
   GitHub collaborators, submit.

## Running everything locally

```bash
# Terminal 1 — API
cd apps/api && npm install && cp .env.example .env && npm run start:dev

# Terminal 2 — Web dashboard
cd apps/web && npm install && npm run dev
# visit http://localhost:5173 — set VITE_API_BASE_URL if api isn't on :3000

# Terminal 3 — Mobile (only once web + api are solid)
cd apps/mobile && npm install && npm start
# set EXPO_PUBLIC_API_BASE_URL to your machine's LAN IP, not localhost,
# if testing on a physical phone
```

See each app's own README/comments for details. `apps/api/README.md` has
the full curl walkthrough for testing the verification pipeline without
Ring wired in yet.
