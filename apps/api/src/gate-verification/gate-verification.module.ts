import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GateCallVerificationService } from './gate-call-verification.service';
import { CalleClientProvider } from './calle-client.provider';

@Module({
  imports: [ConfigModule],
  providers: [CalleClientProvider, GateCallVerificationService],
  exports: [GateCallVerificationService],
})
export class GateVerificationModule {}
