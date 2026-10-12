import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const CALLE_CLIENT = 'CALLE_CLIENT';

/**
 * Fake client used whenever CALLE_MODE is not "live". Makes zero network
 * requests. Numbers ending in 9 simulate an evasive visitor; every other
 * number simulates a clear, plausible one, so demos can show both outcomes.
 */
class FakeCalleClient {
  private readonly logger = new Logger('FakeCalleClient (DRY RUN)');
  private readonly tasks = new Map<string, string>();

  calls = {
    create: async (input: any) => {
      const id = `fake_${Date.now()}`;
      this.tasks.set(id, String(input.task));
      this.logger.warn(
        `DRY RUN — no real call placed. Task preview: "${String(input.task).slice(0, 60)}..."`,
      );
      return { id, status: 'completed' };
    },
    waitForResult: async (callId: string) => this.fakeResult(callId),
    get: async (callId: string) => this.fakeResult(callId),
  };

  private fakeResult(callId: string) {
    const task = this.tasks.get(callId) ?? '';
    const phone = (task.match(/\+\d+/) ?? [''])[0];
    const suspicious = phone.endsWith('9');

    if (suspicious) {
      return {
        id: callId,
        status: 'completed',
        summary:
          'Visitor was evasive, would not give a name, and only said he needed to come in to see someone.',
        structuredResult: {
          outcome: 'suspicious',
          statedName: '',
          statedPurpose: 'Needs to come in to see someone',
          concernNote: 'Visitor refused to give a name or a specific purpose.',
        },
      };
    }

    return {
      id: callId,
      status: 'completed',
      summary:
        'Visitor said he is Emeka from Jumia Express, delivering a parcel (order JM-48213) for the Okafor family.',
      structuredResult: {
        outcome: 'legitimate',
        statedName: 'Emeka',
        statedPurpose: 'Jumia Express parcel delivery, order JM-48213',
        concernNote: '',
      },
    };
  }
}

export const CalleClientProvider: Provider = {
  provide: CALLE_CLIENT,
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    const mode = config.get<string>('CALLE_MODE', 'dry_run');
    const logger = new Logger('CalleClientProvider');

    if (mode !== 'live') {
      logger.warn(
        'CALLE_MODE is not "live" — using FakeCalleClient. No real calls will be placed.',
      );
      return new FakeCalleClient();
    }

    const liveConfirm = config.get<string>('CALLE_LIVE_CONFIRM');
    if (liveConfirm !== 'I_UNDERSTAND_THIS_DIALS_REAL_VISITORS') {
      throw new Error(
        'CALLE_MODE=live requires CALLE_LIVE_CONFIRM=I_UNDERSTAND_THIS_DIALS_REAL_VISITORS. ' +
          'This is a deliberate guard against accidentally dialing real people.',
      );
    }

    const apiKey = config.get<string>('CALLE_API_KEY');
    if (!apiKey) {
      throw new Error('CALLE_API_KEY is required when CALLE_MODE=live.');
    }

    // @call-e/calle ships ESM-only; this project compiles to CommonJS, so a
    // plain import() would be downleveled into require() and throw
    // ERR_REQUIRE_ESM. Wrapping it in `new Function` keeps it a real ESM import.
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const { CalleClient } = await dynamicImport('@call-e/calle');
    logger.log('CALLE_MODE=live — real outbound calls are ENABLED.');
    return new CalleClient({ apiKey });
  },
};