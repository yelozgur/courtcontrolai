
'use server';
/**
 * @fileOverview AI Bracket Generator Flow
 * 
 * Generates initial tournament brackets including Bye logic and seeding.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ParticipantInputSchema = z.object({
  id: z.string(),
  name: z.string(),
  rating: z.number()
});

const BracketInputSchema = z.object({
  tournamentId: z.string(),
  participants: z.array(ParticipantInputSchema),
  categoryName: z.string()
});

const MatchDraftSchema = z.object({
  round: z.number(),
  bracketPosition: z.number(),
  teamA: z.object({ id: z.string(), name: z.string() }).optional(),
  teamB: z.object({ id: z.string(), name: z.string() }).optional(),
  isBye: z.boolean(),
  byePlayerId: z.string().optional()
});

const BracketOutputSchema = z.object({
  matches: z.array(MatchDraftSchema),
  summary: z.string()
});

export async function generateTournamentBracket(input: z.infer<typeof BracketInputSchema>): Promise<z.infer<typeof BracketOutputSchema>> {
  const flow = ai.defineFlow(
    {
      name: 'generateBracket',
      inputSchema: BracketInputSchema,
      outputSchema: BracketOutputSchema,
    },
    async (input) => {
      const prompt = ai.definePrompt({
        name: 'bracketPrompt',
        input: { schema: BracketInputSchema },
        output: { schema: BracketOutputSchema },
        prompt: `You are a Tournament Logic Expert.
Generate a Round 1 bracket for "{{{categoryName}}}".
Participants: {{#each participants}} {{name}} (Rating: {{rating}}), {{/each}}

RULES:
1. Use standard bracket seeding (highest rating plays lowest).
2. If the number of participants is not a power of 2, assign BYEs to the highest-seeded players.
3. Every match must have a round (1) and a unique bracketPosition.
4. Output a list of match drafts.`
      });

      const { output } = await prompt(input);
      return output!;
    }
  );

  return flow(input);
}
