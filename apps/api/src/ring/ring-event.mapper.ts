import { Logger } from '@nestjs/common';
import { VisitorEventDto } from '../verification/dto/visitor-event.dto';

/**
 * IMPORTANT, read before wiring this to a live webhook:
 *
 * Ring's webhook payload tells GateGuard a device event happened
 * (button press / motion) — it does NOT include the visitor's phone
 * number. Ring has no concept of "who is standing at the door" beyond
 * video/audio. This means a real Ring-triggered event has no number for
 * CALL-E to dial, so it will correctly fall through to the
 * `unreachable_fallback` path and be handed to the gateman's on-site
 * decision in the mobile app — that's accurate behavior, not a bug.
 *
 * If you want CALL-E's phone verification to run on Ring-triggered events
 * too (not just manual/API-triggered ones), you need a separate source for
 * the visitor's number — e.g. a pre-registered "expected visitors" list
 * keyed by siteId + time window, or a keypad/intercom step before the
 * doorbell fires. That's a real product decision, not a missing line of
 * code — mention it as a known next step in your demo/feedback, it's a
 * legitimate design tradeoff to call out.
 *
 * Field paths below follow the JSON:API shape described in Ring's docs
 * (a top-level `data.attributes` object) and the one confirmed event type
 * name, "button_press". Ring's docs are still being finalized for this
 * hackathon — once you've registered your webhook URL in the Ring
 * Developer Portal and received a real delivery, check the portal's
 * webhook delivery log and adjust the field paths below to match exactly
 * what you actually receive. The raw payload is logged below specifically
 * to make that adjustment fast.
 */

const logger = new Logger('RingEventMapper');

export function mapRingWebhookToVisitorEvent(payload: any): VisitorEventDto | null {
  logger.debug(`Raw Ring webhook payload: ${JSON.stringify(payload)}`);

  const attributes = payload?.data?.attributes ?? payload?.attributes ?? payload;
  const rawEventType: string | undefined = attributes?.eventType ?? attributes?.type;

  if (!rawEventType) {
    logger.warn('Ring webhook payload had no recognizable event type — dropping.');
    return null;
  }

  const eventType = mapEventType(rawEventType);
  if (!eventType) {
    logger.warn(`Unhandled Ring event type "${rawEventType}" — dropping.`);
    return null;
  }

  const deviceId: string | undefined =
    attributes?.deviceId ?? attributes?.device?.id ?? payload?.data?.relationships?.device?.data?.id;
  const locationId: string | undefined = attributes?.locationId ?? attributes?.location?.id;
  const eventId: string =
    payload?.data?.id ?? attributes?.eventId ?? `ring_${deviceId ?? 'unknown'}_${Date.now()}`;

  return {
    eventId,
    // Prefer a human-set location name if you maintain a deviceId -> siteId
    // mapping; falling back to the raw IDs keeps this usable without one.
    siteId: locationId ?? deviceId ?? 'unknown-site',
    eventType,
    // Deliberately omitted — see the note above. Leave unset so
    // VerificationService correctly routes this to the offline fallback.
    visitorPhoneNumber: undefined,
    snapshotUrl: attributes?.snapshotUrl ?? attributes?.thumbnailUrl,
    notes: `Ring device ${deviceId ?? 'unknown'} at ${locationId ?? 'unknown location'}`,
  };
}

function mapEventType(ringType: string): VisitorEventDto['eventType'] | null {
  switch (ringType) {
    case 'button_press':
      return 'doorbell_press';
    case 'motion':
    case 'motion_detected':
      return 'motion';
    default:
      return null;
  }
}
