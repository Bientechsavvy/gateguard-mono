import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CalleClient, Call } from '@call-e/calle';
import { CALLE_CLIENT } from './calle-client.provider';
import { VisitorEventDto } from '../verification/dto/visitor-event.dto';

export type GateOutcome = 'legitimate' | 'suspicious' | 'unknown';

export interface GateCallResult {
  outcome: GateOutcome;
  reachable: boolean;
  statedName?: string;
  statedPurpose?: string;
  concernNote?: string;
  summary: string;
  calleCallId: string;
}

/**
 * Shape of the request actually sent, matching the LIVE CALL-E API contract
 * (docs.heycall-e.com/calls) rather than the installed @call-e/calle@0.1.0
 * package's stale CreateCallInput type, which incorrectly requires a
 * `recipient` field the live API rejects with a 422. See DispatchCheck's
 * original comment on this — same workaround, reused as-is.
 */
interface DispatchCallRequest {
  task: string;
  resultSchema: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * JSON Schema passed to CALL-E as `resultSchema`. CALL-E's agent extracts
 * this from the call and returns it on `call.structuredResult`, so
 * GateGuard never has to regex-parse a transcript to know what the
 * visitor actually said.
 */
const GATE_VERIFICATION_RESULT_SCHEMA = {
  type: 'object',
  required: ['outcome'],
  properties: {
    outcome: {
      type: 'string',
      enum: ['legitimate', 'suspicious', 'unknown'],
      description:
        'legitimate = the visitor gave a specific, plausible name and purpose ' +
        '(a named person expected at the address, a named delivery service with ' +
        'a reference, a named business/service call). ' +
        'suspicious = the visitor was vague, evasive, gave inconsistent answers, ' +
        'or refused to state a purpose. ' +
        'unknown = the call did not produce a clear answer (e.g. no meaningful conversation happened).',
    },
    statedName: {
      type: 'string',
      description: "The visitor's stated name, if given. Empty string if not given.",
    },
    statedPurpose: {
      type: 'string',
      description: 'The visitor\'s stated reason for being at the gate. Empty string if not given.',
    },
    concernNote: {
      type: 'string',
      description:
        'A one-sentence reason the call was flagged suspicious. Empty string if outcome is not suspicious.',
    },
  },
  additionalProperties: false,
};

@Injectable()
export class GateCallVerificationService {
  private readonly logger = new Logger(GateCallVerificationService.name);

  constructor(@Inject(CALLE_CLIENT) private readonly calle: CalleClient) {}

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 6) return '***';
    return `${phone.slice(0, 4)}${'*'.repeat(phone.length - 6)}${phone.slice(-2)}`;
  }

  /**
   * Places an outbound call to the visitor's number to verify who they are
   * and why they're at the gate, before the gateman lets them in. Returns
   * a structured GateCallResult so the rest of the app never deals with
   * raw call transcripts.
   */
  async verifyVisitor(event: VisitorEventDto): Promise<GateCallResult> {
    const phone = event.visitorPhoneNumber!; // caller guarantees this is set

    const input: DispatchCallRequest = {
      task: this.buildTaskPrompt(event),
      resultSchema: GATE_VERIFICATION_RESULT_SCHEMA,
      metadata: {
        source: 'gateguard',
        eventId: event.eventId,
        siteId: event.siteId,
        eventType: event.eventType,
      },
    };

    this.logger.log(
      `Placing verification call to ${this.maskPhone(phone)} for event ${event.eventId} at ${event.siteId}`,
    );

    // `as any`: see DispatchCallRequest comment above.
    //
    // Deliberately NOT using the SDK's createAndWait() convenience method.
    // It bundles call creation and result-polling into one call, so a
    // transient network error partway through polling throws away the
    // call.id along with it — even though the call itself may have
    // completed fine on CALL-E's side. Creating first and polling
    // separately means a polling hiccup can retry against the SAME call
    // instead of silently losing track of a real, possibly-completed call.
    const created: Call = await this.calle.calls.create(input as any, {
      idempotencyKey: `gateguard_event_${event.eventId}`,
    });

    this.logger.log(`Call ${created.id} created, waiting for result...`);

    const call = await this.waitForResultWithRetry(created.id);

    this.logger.log(
      `Call ${call.id} finished with status=${call.status} structuredResult=${JSON.stringify(
        call.structuredResult,
      )}`,
    );

    return this.interpretResult(call);
  }

  /**
   * Polls for the terminal call result, retrying on transient network
   * errors rather than giving up on the first one. The call itself keeps
   * running on CALL-E's side regardless of whether polling drops, so
   * retrying against the same call.id is always safe and never re-dials
   * the visitor.
   */
  private async waitForResultWithRetry(callId: string, maxAttempts = 3): Promise<Call> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.calle.calls.waitForResult(callId, {
          timeoutMs: 120_000,
          intervalMs: 2_000,
        });
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `waitForResult attempt ${attempt}/${maxAttempts} failed for call ${callId}: ${
            (err as Error).message
          }`,
        );
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        }
      }
    }

    this.logger.warn(
      `Polling failed ${maxAttempts}x for call ${callId}, falling back to a direct GET.`,
    );
    try {
      return await this.calle.calls.get(callId);
    } catch (err) {
      this.logger.error(
        `Direct GET also failed for call ${callId}: ${(err as Error).message}. ` +
          `Original polling error: ${(lastError as Error)?.message}`,
      );
      throw lastError;
    }
  }

  private buildTaskPrompt(event: VisitorEventDto): string {
    return [
      `Call ${event.visitorPhoneNumber} — this person just triggered a ${event.eventType} at the gate of ${event.siteId}.`,
      `Politely ask who they are and the purpose of their visit.`,
      `Determine whether they give a specific, plausible answer (a named person expected at the address, a named delivery service with a reference/order, a named business or service call)`,
      `versus a vague, evasive, or inconsistent one.`,
      event.notes ? `Context from the site: ${event.notes}.` : '',
      `Keep the call short and friendly.`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Prefers the structured result CALL-E's agent explicitly filled in.
   * Falls back to treating the call as UNREACHABLE for calls that never
   * connected (no answer, switched off, provider failure) — those never
   * get a structuredResult at all. Fail-safe: never let an unverified
   * visitor look approvable by default.
   */
  private interpretResult(call: Call): GateCallResult {
    const structured = call.structuredResult as
      | { outcome?: string; statedName?: string; statedPurpose?: string; concernNote?: string }
      | null;

    if (!structured?.outcome || structured.outcome === 'unknown') {
      this.logger.warn(
        `Call ${call.id} produced no clear outcome (status=${call.status}, ` +
          `structuredResult=${JSON.stringify(call.structuredResult)}). Treating as unreachable.`,
      );
      return {
        outcome: 'unknown',
        reachable: false,
        summary: call.summary ?? 'No answer or call could not be completed.',
        calleCallId: call.id,
      };
    }

    return {
      outcome: structured.outcome as GateOutcome,
      reachable: true,
      statedName: structured.statedName,
      statedPurpose: structured.statedPurpose,
      concernNote: structured.concernNote,
      summary: call.summary ?? '',
      calleCallId: call.id,
    };
  }
}
