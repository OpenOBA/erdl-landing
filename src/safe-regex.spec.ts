import { describe, expect, it } from 'vitest';

import { analyzePattern, SafeRegExpError, safeRegExp } from './safe-regex.js';

describe('safe-regex — regular subset (accepted)', () => {
  it('accepts literals, shorthands and escapes', () => {
    expect(analyzePattern('rm\\s+-rf')).toBeNull();
    expect(analyzePattern('a\\d+')).toBeNull();
    expect(safeRegExp('^/etc/').test('/etc/hosts')).toBe(true);
  });

  it('accepts alternation and character classes', () => {
    expect(analyzePattern('(rm|shutdown|reboot)')).toBeNull();
    expect(analyzePattern('[a-z]+')).toBeNull();
    expect(analyzePattern('[a-zA-Z0-9_-]+')).toBeNull();
  });

  it('accepts bounded repetition', () => {
    expect(analyzePattern('a{1,10}')).toBeNull();
    expect(analyzePattern('\\d{2,4}')).toBeNull();
  });

  it('accepts named and non-capturing groups (regular)', () => {
    expect(analyzePattern('(?<name>abc)')).toBeNull();
    expect(analyzePattern('(?:abc)')).toBeNull();
  });

  it('does not confuse an escaped backslash-digit with a backreference', () => {
    // \\1 is a literal backslash followed by "1", not a backreference
    expect(analyzePattern('\\\\1')).toBeNull();
  });

  it('does not flag a backslash inside a character class', () => {
    expect(analyzePattern('[\\]]')).toBeNull();
  });
});

describe('safe-regex — non-regular subset (rejected)', () => {
  it('rejects numeric backreferences', () => {
    expect(analyzePattern('(a)\\1')).toMatch(/backreference/);
    expect(analyzePattern('\\1(a)')).toMatch(/backreference/);
  });

  it('rejects named backreferences', () => {
    expect(analyzePattern('\\k<name>')).toMatch(/backreference/);
  });

  it('rejects lookahead', () => {
    expect(analyzePattern('(?=a)b')).toMatch(/lookahead/);
    expect(analyzePattern('(?!a)b')).toMatch(/lookahead/);
  });

  it('rejects lookbehind', () => {
    expect(analyzePattern('(?<=a)b')).toMatch(/lookbehind/);
    expect(analyzePattern('(?<!a)b')).toMatch(/lookbehind/);
  });
});

describe('safe-regex — ReDoS gates (existing)', () => {
  it('rejects nested quantifiers', () => {
    expect(analyzePattern('(a+)+')).toMatch(/nested/);
    expect(analyzePattern('(a*)*')).toMatch(/nested/);
  });

  it('rejects adjacent identical quantified atoms', () => {
    expect(analyzePattern('a*a*a*b')).toMatch(/adjacent/);
  });
});

describe('safe-regex — inline flags and invalid patterns', () => {
  it('rejects inline (?i) via the JS parser (no inline case-insensitivity)', () => {
    expect(() => safeRegExp('(?i)abc')).toThrow(SafeRegExpError);
  });

  it('rejects atomic groups via the JS parser', () => {
    expect(() => safeRegExp('(?>a)b')).toThrow(SafeRegExpError);
  });
});
