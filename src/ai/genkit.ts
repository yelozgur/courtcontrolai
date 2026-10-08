import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export function isAiEnabled(): boolean {
  const key = process.env.GOOGLE_GENAI_API_KEY;
  return (
    typeof key === 'string' &&
    key.trim().length > 0 &&
    !key.includes('your_') &&
    !key.includes('xxx')
  );
}

function getAi() {
  if (!isAiEnabled()) {
    return null;
  }

  const modelName = process.env.GOOGLE_AI_MODEL || 'googleai/gemini-2.5-flash-lite';

  return genkit({
    plugins: [googleAI()],
    model: modelName,
  });
}

export const ai = getAi();

/**
 * Quota tracking: her AI call'da increment edilir, $0.10/$0.40 Flash-Lite
 * pricing uzerinden tahmini cost hesaplar.
 *
 * Sprint 4: aiUsageCount field'i club doc'unda, cron ile aylik reset.
 */
export interface QuotaInfo {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

const PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  'googleai/gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'googleai/gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'googleai/gemini-3.1-flash-lite': { input: 0.25, output: 1.50 },
};

export function estimateCost(modelName: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_PER_MILLION[modelName] || { input: 0.10, output: 0.40 };
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}
