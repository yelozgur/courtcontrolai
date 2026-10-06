import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn()', () => {
  it('merges multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('drops falsy values', () => {
    expect(cn('foo', undefined, null, false, '', 'bar')).toBe('foo bar');
  });

  it('later Tailwind classes win over earlier conflicting ones', () => {
    // p-4 overrides p-2, but bg-red-500 and text-white stay
    const merged = cn('p-2 text-white', 'p-4 bg-red-500');
    expect(merged).toContain('p-4');
    expect(merged).not.toContain('p-2');
    expect(merged).toContain('text-white');
    expect(merged).toContain('bg-red-500');
  });

  it('accepts arrays and objects (clsx syntax)', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
  });

  it('returns empty string for no input', () => {
    expect(cn()).toBe('');
  });
});
