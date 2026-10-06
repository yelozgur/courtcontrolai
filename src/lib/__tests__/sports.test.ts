import { describe, it, expect } from 'vitest';
import { COMPREHENSIVE_SPORTS } from '../sports';

describe('COMPREHENSIVE_SPORTS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(COMPREHENSIVE_SPORTS)).toBe(true);
    expect(COMPREHENSIVE_SPORTS.length).toBeGreaterThan(0);
  });

  it('includes the core racket sports', () => {
    const values = COMPREHENSIVE_SPORTS.map((s) => s.value);
    expect(values).toContain('padel');
    expect(values).toContain('tennis');
    expect(values).toContain('badminton');
    expect(values).toContain('pickleball');
  });

  it('has rugby (regression test for sprint1 typo fix)', () => {
    // sprint1 regression: was misspelled as "ruby" — make sure it's still "rugby"
    const values = COMPREHENSIVE_SPORTS.map((s) => s.value);
    expect(values).toContain('rugby');
    expect(values).not.toContain('ruby');
  });

  it('every entry has a label and unique value', () => {
    const values = new Set<string>();
    for (const s of COMPREHENSIVE_SPORTS) {
      expect(s.label).toBeTruthy();
      expect(s.value).toBeTruthy();
      expect(values.has(s.value)).toBe(false);
      values.add(s.value);
    }
  });
});
