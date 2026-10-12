import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VerificationModule } from './verification/verification.module';
import { RingModule } from './ring/ring.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    VerificationModule,
    RingModule,
  ],
})
export class AppModule {}
