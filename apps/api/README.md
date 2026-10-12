# GateGuard API

AI-powered visitor and delivery verification for gated compounds and small
businesses in Nigeria and Benin Republic. Built for the **Ring** track of
the Amazon Developer Hackathon, with an **AWS Builder** mini-challenge
integration via Amazon Bedrock.

## How it works

1. A visitor triggers a Ring doorbell/motion event at the gate.
2. GateGuard calls [CALL-E](https://www.heycall-e.com) — the same calling
   engine behind [[dispatchcheck]] — to place a real verification call
   asking the visitor who they are and their purpose. CALL-E returns a
   **structured** result directly (`legitimate` / `suspicious` / `unknown`,
   plus the visitor's stated name and purpose) — no transcript parsing
   needed.
3. Amazon Bedrock independently reviews CALL-E's call summary as a second
   opinion. Either CALL-E or Bedrock flagging the call as suspicious is
   enough to hold it for human review — this two-model check is the AWS
   Builder integration, and it's a genuine pipeline rather than a single
   bolted-on API call.
4. A family member abroad (or an on-site manager) sees the event, both
   models' verdicts, and approves or denies access remotely.
5. If there's no number to call, or the call never connects, the event
   falls back to the gateman's on-site decision — the offline-first path.

## Status

The verification pipeline is complete and fully testable today with fake
trigger events. The Ring event mapper (step 1) is the next piece to wire
in.

## Setup

### Quick start (safe demo — no CALL-E account needed)

```bash
npm install
cp .env.example .env
npm run start:dev
```

This runs in `CALLE_MODE=dry_run` by default — calls are simulated, no
real number is dialed, and no CALL-E account is required. You do need to
set `DASHBOARD_API_KEY` (a dev default is already in `.env.example`),
since every `/verification` route requires it.

### Enabling real calls

Only do this with a CALL-E account and phone numbers you're explicitly
authorized to dial. In `.env`, set:

- `CALLE_MODE=live`
- `CALLE_API_KEY=<your real key>`
- `CALLE_LIVE_CONFIRM=I_UNDERSTAND_THIS_DIALS_REAL_VISITORS`

## Testing the pipeline without Ring yet

All routes require `X-API-Key` matching your `DASHBOARD_API_KEY`.

```bash
# 1. Simulate a visitor event — this places (or, in dry_run, simulates) the
#    CALL-E verification call and returns the full result immediately.
curl -X POST http://localhost:3000/verification/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: changeme_dev_only" \
  -d '{"eventId":"evt-001","siteId":"site-lagos-01","eventType":"doorbell_press","visitorPhoneNumber":"+2348000000000"}'

# 2. Check the flagged result (CALL-E's outcome + Bedrock's second opinion)
curl http://localhost:3000/verification/evt-001 -H "X-API-Key: changeme_dev_only"

# 3. Diaspora approval
curl -X POST http://localhost:3000/verification/evt-001/decision \
  -H "Content-Type: application/json" \
  -H "X-API-Key: changeme_dev_only" \
  -d '{"approve": true, "decidedBy": "daughter-in-london"}'
```

## Next steps

- [ ] Wire the Ring API/simulator (`ring-api-helloworld` as starting point)
      to POST normalized events to `/verification/events`
- [ ] Add a `RingEventMapper` translating Ring webhook payloads into
      `VisitorEventDto`
- [ ] Build out the diaspora dashboard (`apps/web`) against these endpoints
      — it already expects this response shape
- [ ] Add a datastore (DynamoDB) in place of the in-memory `Map`
- [ ] Record the demo video showing the full loop end-to-end

## AWS services used (for hackathon Product Feedback)

- **Amazon Bedrock** (`BedrockFlaggerService`) — reviews CALL-E's call
  summary independently and flags suspicious/vague visitor responses,
  acting as a second check alongside CALL-E's own structured outcome.

## Auth & privacy

- All `/verification` routes require an `X-API-Key` header matching
  `DASHBOARD_API_KEY`.
- Phone numbers are masked in logs (same pattern as DispatchCheck).
- `CALLE_MODE=live` requires the explicit `CALLE_LIVE_CONFIRM` value —
  a deliberate two-step guard against accidentally dialing real people
  during development or demo prep.
