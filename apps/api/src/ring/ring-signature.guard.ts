import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Per Ring's docs: "All webhooks include an HMAC-SHA256 signature in the
 * X-Signature header." The exact encoding (hex vs base64) and whether the
 * header carries a raw digest or a prefixed value (e.g. "sha256=...") isn't
 * fully detailed in the current docs — this implements the common
 * hex-digest convention. If your registered webhook's first real delivery
 * fails verification, log the raw X-Signature header value and compare it
 * against the hex/base64 variants to confirm which one Ring actually sends,
 * then adjust `expectedHex` below accordingly.
 *
 * Requires the raw request body bytes (not the re-serialized parsed JSON)
 * to compute a matching signature — see main.ts's `rawBody: true` option,
 * which this guard depends on.
 */
@Injectable()
export class RingSignatureGuard implements CanActivate {
  private readonly logger = new Logger(RingSignatureGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const secret = this.config.get<string>('RING_WEBHOOK_SECRET');

    if (!secret) {
      throw new UnauthorizedException('Server misconfigured: RING_WEBHOOK_SECRET not set.');
    }

    const signatureHeader = req.headers['x-signature'];
    const provided = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    if (!provided) {
      throw new UnauthorizedException('Missing X-Signature header.');
    }

    const rawBody: Buffer | undefined = req.rawBody;
    if (!rawBody) {
      // Should not happen if main.ts's rawBody:true is in place — fail
      // closed rather than silently skipping verification.
      throw new UnauthorizedException(
        'Raw request body unavailable for signature verification — check rawBody is enabled in main.ts.',
      );
    }

    const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex');

    const providedBuf = Buffer.from(provided.replace(/^sha256=/, ''), 'hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');

    const valid =
      providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);

    if (!valid) {
      this.logger.warn('Ring webhook signature verification failed.');
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    return true;
  }
}
