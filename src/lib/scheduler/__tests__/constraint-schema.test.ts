import { describe, it, expect } from 'vitest';
import {
  schedulePreferencesSchema,
  emptyPreferences,
} from '../constraint-schema';

describe('schedulePreferencesSchema', () => {
  it('accepts a valid complete object', () => {
    const result = schedulePreferencesSchema.parse({
      courtPriority: ['c1', 'c2'],
      dayCompaction: true,
      minRestMinutes: 45,
      categoryDurations: { 'cat-1': 45 },
    });
    expect(result.courtPriority).toEqual(['c1', 'c2']);
    expect(result.dayCompaction).toBe(true);
    expect(result.minRestMinutes).toBe(45);
    expect(result.categoryDurations).toEqual({ 'cat-1': 45 });
  });

  it('applies defaults for missing fields', () => {
    const result = schedulePreferencesSchema.parse({});
    expect(result).toEqual(emptyPreferences);
  });

  it('rejects unknown keys (strict mode)', () => {
    expect(() =>
      schedulePreferencesSchema.parse({
        courtPriority: ['c1'],
        unknownField: 'should fail',
      })
    ).toThrow();
  });

  it('rejects negative minRestMinutes', () => {
    expect(() =>
      schedulePreferencesSchema.parse({ minRestMinutes: -1 })
    ).toThrow();
  });

  it('rejects minRestMinutes above 240', () => {
    expect(() =>
      schedulePreferencesSchema.parse({ minRestMinutes: 300 })
    ).toThrow();
  });

  it('rejects category duration below 15', () => {
    expect(() =>
      schedulePreferencesSchema.parse({ categoryDurations: { 'cat-1': 5 } })
    ).toThrow();
  });

  it('rejects category duration above 240', () => {
    expect(() =>
      schedulePreferencesSchema.parse({ categoryDurations: { 'cat-1': 300 } })
    ).toThrow();
  });

  it('rejects non-integer minRestMinutes', () => {
    expect(() =>
      schedulePreferencesSchema.parse({ minRestMinutes: 30.5 })
    ).toThrow();
  });

  it('rejects non-boolean dayCompaction', () => {
    expect(() =>
      schedulePreferencesSchema.parse({ dayCompaction: 'yes' })
    ).toThrow();
  });

  it('rejects non-array courtPriority', () => {
    expect(() =>
      schedulePreferencesSchema.parse({ courtPriority: 'c1' })
    ).toThrow();
  });
});

describe('emptyPreferences', () => {
  it('matches the schema defaults', () => {
    const parsed = schedulePreferencesSchema.parse({});
    expect(parsed).toEqual(emptyPreferences);
  });
});
