import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RingWebhookController } from './ring-webhook.controller';
import { RingLinkController } from './ring-link.controller';
import { RingSignatureGuard } from './ring-signature.guard';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [ConfigModule, VerificationModule],
  controllers: [RingWebhookController, RingLinkController],
  providers: [RingSignatureGuard],
})
export class RingModule {}
