import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * CourtControl AI: Local gelistirmede GOOGLE_GENAI_API_KEY yoksa
 * Gemini'ye gitmek yerine echo mock kullanilir. Output: input'un
 * JSON parse edilmis hali, deterministic — debug icin ideal.
 *
 * Production'da GOOGLE_GENAI_API_KEY env set edilir ve googleAI() plugin
 * devreye girer, mock kullanilmaz.
 */
function getAi() {
  const hasKey = !!process.env.GOOGLE_GENAI_API_KEY &&
                 process.env.GOOGLE_GENAI_API_KEY !== 'your_google_ai_key_here';

  if (!hasKey) {
    // eslint-disable-next-line no-console
    console.info('[genkit] GOOGLE_GENAI_API_KEY yok, echo mock devrede (local dev mode)');
    // Mock: genkit'i minimum config ile baslat, AI flow'lar kendi fallback'lerini kullanir
    return genkit({
      model: 'echo',
    });
  }

  return genkit({
    plugins: [googleAI()],
    model: 'googleai/gemini-2.5-flash',
  });
}

export const ai = getAi();
