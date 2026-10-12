import { Body, Controller, HttpCode, Post, UseGuards, Logger } from '@nestjs/common';
import { VerificationService } from '../verification/verification.service';
import { RingSignatureGuard } from './ring-signature.guard';
import { mapRingWebhookToVisitorEvent } from './ring-event.mapper';

/**
 * This is the real Ring integration point — GateGuard's required runtime
 * call into Ring's technology per the hackathon rules. Register this
 * route's public URL (e.g. https://your-domain/ring/webhook) as the
 * Webhook URL in the Ring Developer Portal under your app's configuration.
 */
@Controller('ring')
export class RingWebhookController {
  private readonly logger = new Logger(RingWebhookController.name);

  constructor(private readonly verificationService: VerificationService) {}

  @UseGuards(RingSignatureGuard)
  @Post('webhook')
  @HttpCode(200) // Ring expects a fast 200 ack; it will retry on non-2xx.
  async handleWebhook(@Body() payload: any) {
    const event = mapRingWebhookToVisitorEvent(payload);

    if (!event) {
      // Ack anyway — an unrecognized/unhandled event type is not a
      // delivery failure, and a non-2xx here would just cause Ring to
      // retry something we're deliberately ignoring.
      this.logger.debug('Ring webhook payload did not map to a visitor event — acknowledged, no action taken.');
      return { received: true, handled: false };
    }

    this.logger.log(`Ring event mapped: ${event.eventType} at ${event.siteId} (eventId=${event.eventId})`);

    // Fire-and-forget is deliberate: CALL-E/Bedrock can take longer than
    // Ring's webhook response-time expectations allow, so we ack
    // immediately and let verification run in the background. The
    // dashboard polls for the result rather than waiting on this response.
    this.verificationService.handleVisitorEvent(event).catch((err) => {
      this.logger.error(`Verification failed for Ring event ${event.eventId}: ${err.message}`);
    });

    return { received: true, handled: true, eventId: event.eventId };
  }
}
