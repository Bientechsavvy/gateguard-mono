import { Injectable, Logger } from '@nestjs/common';
import { VisitorEventDto } from './dto/visitor-event.dto';
import { GateCallVerificationService } from '../gate-verification/gate-call-verification.service';
import { BedrockFlaggerService } from './providers/bedrock-flagger.service';

export type VerificationStatus =
  | 'awaiting_decision'
  | 'approved'
  | 'denied'
  | 'unreachable_fallback'; // offline-first path: no number, or call never connected

export interface VerificationRecord {
  event: VisitorEventDto;
  status: VerificationStatus;
  calleCallId?: string;
  statedName?: string;
  statedPurpose?: string;
  summary?: string;
  suspicious?: boolean;
  flagReason?: string;
  decidedBy?: string;
  decidedAt?: Date;
}

/**
 * Orchestrates one visitor-verification lifecycle:
 * Ring event -> CALL-E verification call -> Bedrock second opinion -> diaspora approval.
 *
 * CALL-E places the call and returns a structured outcome directly (this is
 * GateGuard's real calling engine, carried over from the DispatchCheck/
 * CALL-E project rather than a placeholder). Bedrock then reviews CALL-E's
 * summary as an independent second check — two different models weighing
 * in beats trusting either one alone, and it's what makes the AWS Builder
 * integration a genuine multi-service pipeline rather than a single call
 * bolted on for the mini-challenge.
 *
 * Storage is in-memory for the hackathon demo — swap the Map for a real
 * datastore (DynamoDB pairs naturally with Bedrock) before any real
 * deployment.
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly records = new Map<string, VerificationRecord>();

  constructor(
    private readonly gateCallVerification: GateCallVerificationService,
    private readonly flagger: BedrockFlaggerService,
  ) {}

  async handleVisitorEvent(event: VisitorEventDto): Promise<VerificationRecord> {
    const record: VerificationRecord = { event, status: 'unreachable_fallback' };
    this.records.set(event.eventId, record);

    if (!event.visitorPhoneNumber) {
      // No number to call — hand off to the gateman's offline decision tree
      // and queue for sync once the dashboard is reachable again.
      this.logger.warn(
        `No phone number for event ${event.eventId} — offline fallback engaged.`,
      );
      return record;
    }

    const calleResult = await this.gateCallVerification.verifyVisitor(event);

    if (!calleResult.reachable) {
      record.status = 'unreachable_fallback';
      record.summary = calleResult.summary;
      this.logger.warn(
        `Call unreachable for event ${event.eventId} — offline fallback engaged.`,
      );
      this.records.set(event.eventId, record);
      return record;
    }

    record.calleCallId = calleResult.calleCallId;
    record.statedName = calleResult.statedName;
    record.statedPurpose = calleResult.statedPurpose;
    record.summary = calleResult.summary;

    // Bedrock reviews CALL-E's own summary as a second, independent check.
    const bedrockFlag = await this.flagger.analyzeTranscript(calleResult.summary, {
      siteId: event.siteId,
      eventType: event.eventType,
    });

    // Either signal flagging it suspicious is enough to hold for human
    // review — fail-safe toward caution, not toward convenience.
    const suspicious = calleResult.outcome === 'suspicious' || bedrockFlag.suspicious;
    const reasonParts = [calleResult.concernNote, bedrockFlag.suspicious ? bedrockFlag.reason : '']
      .filter(Boolean);

    record.suspicious = suspicious;
    record.flagReason = reasonParts.length
      ? reasonParts.join(' | ')
      : 'No concerns flagged by CALL-E or Bedrock.';
    record.status = 'awaiting_decision';

    this.records.set(event.eventId, record);
    return record;
  }

  /**
   * Called when a diaspora family member (or on-site manager) approves or
   * denies access from the dashboard.
   */
  decide(eventId: string, approve: boolean, decidedBy: string): VerificationRecord {
    const record = this.records.get(eventId);
    if (!record) {
      throw new Error(`No verification record for event ${eventId}`);
    }
    record.status = approve ? 'approved' : 'denied';
    record.decidedBy = decidedBy;
    record.decidedAt = new Date();
    this.records.set(eventId, record);
    return record;
  }

  get(eventId: string): VerificationRecord | undefined {
    return this.records.get(eventId);
  }

  list(): VerificationRecord[] {
    return Array.from(this.records.values());
  }
}
