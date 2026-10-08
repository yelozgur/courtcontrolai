import { ai, isAiEnabled } from '@/ai/genkit';
import {
  schedulePreferencesSchema,
  emptyPreferences,
  type SchedulePreferences,
} from './constraint-schema';

export interface TranslationContext {
  courtIds: string[];
  courtNames: Record<string, string>;
  categoryIds: string[];
  categoryNames: Record<string, string>;
}

export interface TranslationResult {
  preferences: SchedulePreferences;
  source: 'model' | 'fallback';
  rejectionReason?: string;
}

const SYSTEM_PROMPT = `You are a scheduling constraint translator for a tennis/padel club tournament scheduler.

The user will describe preferences in natural language. You must translate them into a JSON object with EXACTLY these fields:

{
  "courtPriority": string[],     // ordered list of court IDs, most preferred first. Empty array = no preference.
  "dayCompaction": boolean,      // true = compress matches into the smallest time window possible
  "minRestMinutes": number,      // minimum rest between same player's matches (0-240, default 30)
  "categoryDurations": Record<string, number>  // category ID -> match duration in minutes (15-240)
}

Rules:
- Output ONLY valid JSON. No markdown, no explanation, no code fences.
- Use ONLY the court IDs and category IDs provided in the context. Unknown keys will be REJECTED.
- If the user says nothing about a field, use its default value.
- courtPriority should list courts in the order the user prefers (first = most preferred).
- dayCompaction is true when the user wants matches packed tightly (e.g. "compress into Friday", "finish early").
- minRestMinutes: if the user says "30 minutes rest" or "half hour between matches", use 30.
- categoryDurations: only include categories the user explicitly mentions a duration for.

Example: user says "put the important matches on court 1, and I want 45 minute matches for the beginner category"
Context: courts = ["c1", "c2"], categories = ["cat-advanced", "cat-beginner"]
Output: {"courtPriority":["c1","c2"],"dayCompaction":false,"minRestMinutes":30,"categoryDurations":{"cat-beginner":45}}`;

export async function translatePreferences(
  naturalLanguage: string,
  context: TranslationContext,
): Promise<TranslationResult> {
  if (!isAiEnabled() || !ai || !naturalLanguage.trim()) {
    return { preferences: { ...emptyPreferences }, source: 'fallback' };
  }

  const userPrompt = `Context:
Available courts: ${JSON.stringify(context.courtIds)}
Court names: ${JSON.stringify(context.courtNames)}
Available categories: ${JSON.stringify(context.categoryIds)}
Category names: ${JSON.stringify(context.categoryNames)}

User preference: "${naturalLanguage}"

Output the JSON constraint object now:`;

  try {
    const response = await ai.generate({
      prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
      config: {
        temperature: 0,
        maxOutputTokens: 512,
      },
    });

    const text = (response.text ?? '').trim();
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const validated = schedulePreferencesSchema.parse(parsed);

    const filteredCourtPriority = validated.courtPriority.filter(
      (id) => context.courtIds.includes(id),
    );
    const filteredCategoryDurations: Record<string, number> = {};
    for (const [catId, dur] of Object.entries(validated.categoryDurations)) {
      if (context.categoryIds.includes(catId)) {
        filteredCategoryDurations[catId] = dur;
      }
    }

    return {
      preferences: {
        courtPriority: filteredCourtPriority,
        dayCompaction: validated.dayCompaction,
        minRestMinutes: validated.minRestMinutes,
        categoryDurations: filteredCategoryDurations,
      },
      source: 'model',
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      preferences: { ...emptyPreferences },
      source: 'fallback',
      rejectionReason: reason,
    };
  }
}
