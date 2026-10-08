import { z } from 'zod';

export const schedulePreferencesSchema = z.strictObject({
  courtPriority: z.array(z.string()).default([]),
  dayCompaction: z.boolean().default(false),
  minRestMinutes: z.number().int().min(0).max(240).default(30),
  categoryDurations: z.record(z.string(), z.number().int().min(15).max(240)).default({}),
}).strict();

export type SchedulePreferences = z.infer<typeof schedulePreferencesSchema>;

export const emptyPreferences: SchedulePreferences = {
  courtPriority: [],
  dayCompaction: false,
  minRestMinutes: 30,
  categoryDurations: {},
};
