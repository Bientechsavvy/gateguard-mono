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

  // Demo behavior: numbers ending in 9 simulate an evasive visitor,
  // every other number simulates a clear, plausible one.
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