// Single source of truth for the shapes shared across api / web / mobile.
// Copy or symlink this file into each app until you wire up a real
// workspace package resolution (kept simple on purpose for the deadline).

export type VerificationStatus =
  | 'awaiting_call'
  | 'awaiting_transcript'
  | 'awaiting_decision'
  | 'approved'
  | 'denied'
  | 'unreachable_fallback';

export interface VisitorEvent {
  eventId: string;
  siteId: string;
  eventType: 'motion' | 'doorbell_press' | 'manual_trigger';
  visitorPhoneNumber?: string;
  snapshotUrl?: string;
  notes?: string;
}

export interface VerificationRecord {
  event: VisitorEvent;
  status: VerificationStatus;
  callSid?: string;
  transcript?: string;
  suspicious?: boolean;
  flagReason?: string;
  decidedBy?: string;
  decidedAt?: string;
}
