import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { VisitorEventDto } from './dto/visitor-event.dto';
import { VerificationService } from './verification.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  /**
   * Entry point for a Ring event (doorbell press / motion), normalized
   * into a VisitorEventDto before it reaches here. The HTTP response
   * returns once CALL-E's verification call resolves, so the dashboard
   * can show the outcome right away — same pattern DispatchCheck uses for
   * order confirmation calls.
   *
   * Also usable directly with a fake payload for testing the pipeline
   * before the Ring integration is wired in.
   */
  @Post('events')
  async receiveVisitorEvent(@Body() event: VisitorEventDto) {
    return this.verificationService.handleVisitorEvent(event);
  }

  /** Diaspora dashboard (or WhatsApp bot) posts the approve/deny decision here. */
  @Post(':eventId/decision')
  decide(
    @Param('eventId') eventId: string,
    @Body('approve') approve: boolean,
    @Body('decidedBy') decidedBy: string,
  ) {
    return this.verificationService.decide(eventId, approve, decidedBy);
  }

  @Get(':eventId')
  getOne(@Param('eventId') eventId: string) {
    return this.verificationService.get(eventId);
  }

  @Get()
  listAll() {
    return this.verificationService.list();
  }
}
