import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { BedrockFlaggerService } from './providers/bedrock-flagger.service';
import { GateVerificationModule } from '../gate-verification/gate-verification.module';

@Module({
  imports: [GateVerificationModule],
  controllers: [VerificationController],
  providers: [VerificationService, BedrockFlaggerService],
  exports: [VerificationService],
})
export class VerificationModule {}
