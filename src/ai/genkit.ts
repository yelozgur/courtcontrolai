import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * CourtControl AI: Local gelistirmede GOOGLE_GENAI_API_KEY yoksa
 * Gemini'ye gitmek yerine echo mock kullanilir. Output: input'un
 * JSON parse edilmis hali, deterministic — debug icin ideal.
 *
 * Production'da GOOGLE_GENAI_API_KEY env set edilir ve googleAI() plugin
 * devreye girer.
 *
 * Model secimi (GOOGLE_AI_MODEL env):
 * - "gemini-2.5-flash-lite" (default, 2026): en ucuz ($0.10/$0.40 per 1M),
 *   1M context, scheduling icin yeterli kalite
 * - "gemini-2.5-flash" (premium override): 3x pahali ama daha akilli
 *   reasoning icin ($0.30/$2.50)
 * - "gemini-3.1-flash-lite" (next-gen): 2.5x hizli, $0.25/$1.50
 *   (2026 Mart, henuz preview)
 */
function getAi() {
  const hasKey = !!process.env.GOOGLE_GENAI_API_KEY &&
                 process.env.GOOGLE_GENAI_API_KEY !== 'your_google_ai_key_here';

  if (!hasKey) {
    // eslint-disable-next-line no-console
    console.info('[genkit] GOOGLE_GENAI_API_KEY yok, echo mock devrede (local dev mode)');
    return genkit({
      model: 'echo',
    });
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
  'echo': { input: 0, output: 0 },
};

export function estimateCost(modelName: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_PER_MILLION[modelName] || { input: 0.10, output: 0.40 };
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}
