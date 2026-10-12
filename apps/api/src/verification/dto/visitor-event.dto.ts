import { IsString, IsOptional, IsPhoneNumber, IsIn } from 'class-validator';

/**
 * Normalized shape of an incoming gate/door event.
 * In production this is populated from a Ring event webhook payload
 * (motion / doorbell-press) via RingEventMapper — see providers/ring.provider.ts.
 * Kept provider-agnostic so the verification pipeline can be tested
 * end-to-end with a fake trigger before the Ring integration is wired in.
 */
export class VisitorEventDto {
  @IsString()
  eventId: string;

  @IsString()
  siteId: string; // which compound / business location

  @IsIn(['motion', 'doorbell_press', 'manual_trigger'])
  eventType: string;

  @IsOptional()
  @IsPhoneNumber()
  visitorPhoneNumber?: string; // if visitor pre-announced via a linked number

  @IsOptional()
  @IsString()
  snapshotUrl?: string; // Ring camera snapshot, if available

  @IsOptional()
  @IsString()
  notes?: string;
}
