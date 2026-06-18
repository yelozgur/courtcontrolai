
'use server';
/**
 * @fileOverview AI Tournament Director Flow
 *
 * - optimizeTournamentSchedule - A function that generates an optimized match schedule based on tournament rules and participants.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  format: z.string(),
});

const ParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string(),
});

const LocationSchema = z.object({
  name: z.string(),
  numCourts: z.number(),
});

const ScheduleInputSchema = z.object({
  tournamentName: z.string(),
  startDate: z.string(),
  matchDuration: z.number(),
  recoveryTime: z.number(),
  locations: z.array(LocationSchema),
  categories: z.array(CategorySchema),
  participants: z.array(ParticipantSchema),
});

export type ScheduleInput = z.infer<typeof ScheduleInputSchema>;

const MatchOutputSchema = z.object({
  category: z.string(),
  categoryId: z.string(),
  teamA: z.object({ name: z.string() }),
  teamB: z.object({ name: z.string() }),
  court: z.number(),
  location: z.string(),
  startTime: z.string().describe('ISO-8601 string format: YYYY-MM-DDTHH:mm:ss'),
});

const ScheduleOutputSchema = z.object({
  scheduledMatches: z.array(MatchOutputSchema),
  summary: z.string(),
});

export type ScheduleOutput = z.infer<typeof ScheduleOutputSchema>;

const prompt = ai.definePrompt({
  name: 'optimizeSchedulePrompt',
  input: { schema: ScheduleInputSchema },
  output: { schema: ScheduleOutputSchema },
  prompt: `You are an elite Tournament Director and Optimization Expert.
Your task is to generate a logical, fair, and efficient match schedule for the tournament: "{{{tournamentName}}}".

CONTEXT:
- Start Date: {{{startDate}}}
- Match Duration: {{{matchDuration}}} minutes
- Recovery Time: {{{recoveryTime}}} minutes (players must have this buffer between matches)
- Venues: {{#each locations}} {{name}} ({{numCourts}} courts), {{/each}}
- Categories: {{#each categories}} {{name}} ({{format}}), {{/each}}

PARTICIPANTS:
{{#each participants}}
- {{name}} (Category ID: {{categoryId}})
{{/each}}

RULES:
1. FOR ROUND ROBIN: Every player in a category must play every other player in that same category exactly once.
2. FOR SINGLE ELIMINATION: Create the first round of matches based on the number of participants. If odd, provide one 'Bye' or simply pair as many as possible.
3. CLASH PREVENTION: A participant cannot be in two places at once. Schedule their matches with at least {{{recoveryTime}}} minutes of buffer.
4. COURT ASSIGNMENT: Distribute matches across available courts in the specified locations.
5. START TIME: Begin matches at 09:00 AM on the start date. Proceed sequentially.

Generate a comprehensive list of scheduled matches that maximizes venue usage.`,
});

export async function optimizeTournamentSchedule(input: ScheduleInput): Promise<ScheduleOutput> {
  const flow = ai.defineFlow(
    {
      name: 'optimizeTournamentSchedule',
      inputSchema: ScheduleInputSchema,
      outputSchema: ScheduleOutputSchema,
    },
    async (input) => {
      const { output } = await prompt(input);
      return output!;
    }
  );

  return flow(input);
}
