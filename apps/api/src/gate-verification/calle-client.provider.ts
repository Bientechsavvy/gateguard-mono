import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const CALLE_CLIENT = 'CALLE_CLIENT';

/**
 * Fake client used whenever CALLE_MODE is not "live". Makes zero network
 * requests and returns a synthetic "legitimate" result so the rest of the
 * verification pipeline (polling, status mapping, dashboard) works
 * normally in demos and local testing — same safety pattern used in
 * DispatchCheck, reused here directly.
 */
class FakeCalleClient {
  private readonly logger = new Logger('FakeCalleClient (DRY RUN)');

  calls = {
    create: async (input: any) => {
      this.logger.warn(
        `DRY RUN — no real call placed. Task preview: "${String(input.task).slice(0, 60)}..."`,
      );
      return { id: `fake_${Date.now()}`, status: 'completed' };
    },
    waitForResult: async (callId: string) => ({
      id: callId,
      status: 'completed',
      summary: 'Dry-run: visitor stated a plausible name and purpose.',
      structuredResult: {
        outcome: 'legitimate',
        statedName: 'Test Visitor',
        statedPurpose: 'Delivery drop-off',
        concernNote: '',
      },
    }),
    get: async (callId: string) => ({
      id: callId,
      status: 'completed',
      summary: 'Dry-run: visitor stated a plausible name and purpose.',
      structuredResult: {
        outcome: 'legitimate',
        statedName: 'Test Visitor',
        statedPurpose: 'Delivery drop-off',
        concernNote: '',
      },
    }),
  };
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

    // @call-e/calle ships ESM-only; this project compiles to CommonJS
    // (standard for NestJS), so a plain `import()` gets downleveled by tsc
    // into `require()` and throws ERR_REQUIRE_ESM. Wrapping in `new
    // Function` is invisible to tsc's transpiler and survives as a real
    // ESM import at runtime — verified against DispatchCheck's compiled
    // dist/ output, not assumed.
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const { CalleClient } = await dynamicImport('@call-e/calle');
    logger.log('CALLE_MODE=live — real outbound calls are ENABLED.');
    return new CalleClient({ apiKey });
  },
};
