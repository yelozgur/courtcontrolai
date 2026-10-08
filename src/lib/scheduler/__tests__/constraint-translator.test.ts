import { describe, it, expect } from 'vitest';
import { translatePreferences, type TranslationContext } from '../constraint-translator';
import { emptyPreferences } from '../constraint-schema';

const ctx: TranslationContext = {
  courtIds: ['c1', 'c2', 'c3'],
  courtNames: { c1: 'Court 1', c2: 'Court 2', c3: 'Court 3' },
  categoryIds: ['cat-open', 'cat-beginner'],
  categoryNames: { 'cat-open': 'Open', 'cat-beginner': 'Beginner' },
};

describe('translatePreferences', () => {
  it('returns fallback when preferencesText is empty', async () => {
    const result = await translatePreferences('', ctx);
    expect(result.source).toBe('fallback');
    expect(result.preferences).toEqual(emptyPreferences);
  });

  it('returns fallback when preferencesText is whitespace only', async () => {
    const result = await translatePreferences('   ', ctx);
    expect(result.source).toBe('fallback');
    expect(result.preferences).toEqual(emptyPreferences);
  });

  it('returns fallback when AI key is absent (production path)', async () => {
    const result = await translatePreferences('put matches on court 1', ctx);
    expect(result.source).toBe('fallback');
    expect(result.preferences).toEqual(emptyPreferences);
  });

  it('fallback result has no rejectionReason when input is empty', async () => {
    const result = await translatePreferences('', ctx);
    expect(result.rejectionReason).toBeUndefined();
  });
});
