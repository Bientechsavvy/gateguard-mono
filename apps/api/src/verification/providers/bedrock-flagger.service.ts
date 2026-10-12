import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

export interface FlagResult {
  suspicious: boolean;
  reason: string;
  confidence: number; // 0-1
}

/**
 * Sends the verification-call transcript to a Bedrock-hosted model and
 * asks it to judge whether the visitor's stated identity/purpose is
 * plausible, vague, or inconsistent with the event context.
 *
 * This is the project's AWS Builder mini-challenge integration — document
 * this call (model used, prompt, why) in the hackathon's Product Feedback
 * answer.
 */
@Injectable()
export class BedrockFlaggerService {
  private readonly logger = new Logger(BedrockFlaggerService.name);
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;

  constructor(private readonly config: ConfigService) {
    this.client = new BedrockRuntimeClient({
      region: this.config.get<string>('AWS_REGION', 'us-east-1'),
    });
    // Swap for whichever Bedrock model your account has enabled
    this.modelId = this.config.get<string>(
      'BEDROCK_MODEL_ID',
      'anthropic.claude-3-haiku-20240307-v1:0',
    );
  }

  async analyzeTranscript(
    transcript: string,
    context: { siteId: string; eventType: string },
  ): Promise<FlagResult> {
    if (!transcript?.trim()) {
      return {
        suspicious: true,
        reason: 'No response captured from visitor — treat as unverified.',
        confidence: 0.6,
      };
    }

    const prompt = `You are a gate-verification assistant for a residential/business compound.
A visitor triggered a "${context.eventType}" event at site "${context.siteId}" and gave this
spoken response when asked to state their name and purpose:

"${transcript}"

Judge whether this response is plausible and specific (e.g. names a person,
company, or delivery reference) or vague/evasive/inconsistent.
Respond ONLY with JSON: {"suspicious": boolean, "reason": string, "confidence": number between 0 and 1}`;

    try {
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const response = await this.client.send(command);
      const body = JSON.parse(new TextDecoder().decode(response.body));
      const text = body?.content?.[0]?.text ?? '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

      return {
        suspicious: Boolean(parsed.suspicious),
        reason: parsed.reason ?? 'No reason returned by model.',
        confidence: Number(parsed.confidence ?? 0.5),
      };
    } catch (err) {
      this.logger.error(`Bedrock analysis failed: ${err.message}`);
      // Fail safe: if the model call errors out, flag for human review
      // rather than silently letting the visitor through.
      return {
        suspicious: true,
        reason: 'Automated analysis unavailable — flagged for manual review.',
        confidence: 0.5,
      };
    }
  }
}
