import { describe, expect, it } from 'vitest';
import { CONFIG, offsetFor, validateConfig } from '../../src/content';
import type { ContentConfig } from '../../src/content';

/** A fresh, valid settings object that each test can break in one place. */
function valid(): Record<string, unknown> {
  return {
    passThreshold: 0.8,
    middleBand: 0.6,
    hintRungs: 3,
    countCorrectAfterSolution: false,
    lesson5NeedsEveryDeleteCase: true,
    retakeOffsets: [0, 7, -7, 13, 3],
    keyRange: [1, 99],
  };
}

// valid() with one field replaced (or removed, with 'undefined').
function withField(field: string, value: unknown): Record<string, unknown> {
  const raw = valid();
  if (value === undefined) delete raw[field];
  else raw[field] = value;
  return raw;
}

describe('the settings file', () => {
  it('holds the lesson plan values', () => {
    // Lesson plan, "Mastery and pass rules": 80% to pass, 60–79% retry the
    // missed items, a three-rung hint ladder, and Lesson 5 needs each delete case.
    expect(CONFIG.passThreshold).toBe(0.8);
    expect(CONFIG.middleBand).toBe(0.6);
    expect(CONFIG.hintRungs).toBe(3);
    expect(CONFIG.lesson5NeedsEveryDeleteCase).toBe(true);
  });

  it('only counts an item as correct before its worked solution is shown', () => {
    expect(CONFIG.countCorrectAfterSolution).toBe(false);
  });

  it('starts the retakes at the original keys and never repeats an offset', () => {
    expect(CONFIG.retakeOffsets[0]).toBe(0);
    expect(new Set(CONFIG.retakeOffsets).size).toBe(CONFIG.retakeOffsets.length);
  });

  it('keeps keys in 1 to 99, so every key fits in a two-digit node', () => {
    expect(CONFIG.keyRange).toEqual([1, 99]);
  });

  it('is frozen, so no screen can change a setting for everyone else', () => {
    expect(Object.isFrozen(CONFIG)).toBe(true);
    expect(Object.isFrozen(CONFIG.retakeOffsets)).toBe(true);
    expect(Object.isFrozen(CONFIG.keyRange)).toBe(true);
  });
});

describe('validateConfig', () => {
  it('accepts valid settings and returns the same values', () => {
    expect(validateConfig(valid())).toEqual(valid());
  });

  it('returns a frozen copy, leaving the input alone', () => {
    const raw = valid();
    const config = validateConfig(raw);
    expect(config).not.toBe(raw);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(raw)).toBe(false);
  });

  it('rejects something that is not a settings object', () => {
    expect(() => validateConfig(null)).toThrow();
    expect(() => validateConfig([])).toThrow();
    expect(() => validateConfig('0.8')).toThrow();
  });

  it('rejects a missing setting, naming it', () => {
    expect(() => validateConfig(withField('hintRungs', undefined))).toThrow(/hintRungs/);
  });

  it('rejects an unknown setting, so a misspelt name fails instead of being ignored', () => {
    expect(() => validateConfig(withField('passThreshhold', 0.9))).toThrow(/passThreshhold/);
  });

  it('rejects a pass mark that is not a share between 0 and 1', () => {
    for (const bad of [0, -0.1, 1.5, 80, '0.8', Number.NaN]) {
      expect(() => validateConfig(withField('passThreshold', bad))).toThrow(/passThreshold/);
    }
    expect(validateConfig(withField('passThreshold', 1)).passThreshold).toBe(1);
  });

  it('rejects a middle band that is not below the pass mark', () => {
    expect(() => validateConfig(withField('middleBand', 0.8))).toThrow(/middleBand/);
    expect(() => validateConfig(withField('middleBand', 0.9))).toThrow(/middleBand/);
    expect(() => validateConfig(withField('middleBand', -0.1))).toThrow(/middleBand/);
    expect(validateConfig(withField('middleBand', 0)).middleBand).toBe(0);
  });

  it('allows one to three hint rungs, since a question has at most a nudge, a highlight and a solution', () => {
    for (const bad of [0, 4, 2.5, '3']) {
      expect(() => validateConfig(withField('hintRungs', bad))).toThrow(/hintRungs/);
    }
    for (const ok of [1, 2, 3]) {
      expect(validateConfig(withField('hintRungs', ok)).hintRungs).toBe(ok);
    }
  });

  it('rejects yes/no settings that are not true or false', () => {
    expect(() => validateConfig(withField('countCorrectAfterSolution', 'false'))).toThrow(
      /countCorrectAfterSolution/,
    );
    expect(() => validateConfig(withField('lesson5NeedsEveryDeleteCase', 1))).toThrow(
      /lesson5NeedsEveryDeleteCase/,
    );
  });

  it('rejects retake offsets that are empty, do not start at 0, repeat, or are not whole numbers', () => {
    for (const bad of [[], [7, 0], [0, 7, 7], [0, 2.5], [0, '7'], 'nope']) {
      expect(() => validateConfig(withField('retakeOffsets', bad))).toThrow(/retakeOffsets/);
    }
    expect(validateConfig(withField('retakeOffsets', [0])).retakeOffsets).toEqual([0]);
  });

  it('rejects a key range that is not two whole numbers, smallest first', () => {
    for (const bad of [[99, 1], [5, 5], [1.5, 99], [1], [1, 50, 99], [0, 99], '1-99']) {
      expect(() => validateConfig(withField('keyRange', bad))).toThrow(/keyRange/);
    }
  });
});

describe('offsetFor', () => {
  it('gives the original keys for the first attempt', () => {
    expect(offsetFor(0)).toBe(0);
  });

  it('gives each retake its own offset, in order', () => {
    expect([1, 2, 3, 4].map((retake) => offsetFor(retake))).toEqual([7, -7, 13, 3]);
  });

  it('wraps round after the last offset', () => {
    const count = CONFIG.retakeOffsets.length;
    expect(offsetFor(count)).toBe(0);
    expect(offsetFor(count + 1)).toBe(7);
  });

  it('rejects a retake number that is negative or not whole', () => {
    expect(() => offsetFor(-1)).toThrow(RangeError);
    expect(() => offsetFor(1.5)).toThrow(RangeError);
    expect(() => offsetFor(Number.NaN)).toThrow(RangeError);
  });

  it('uses the settings it is given', () => {
    const config: ContentConfig = validateConfig(withField('retakeOffsets', [0, 20]));
    expect(offsetFor(1, config)).toBe(20);
    expect(offsetFor(2, config)).toBe(0);
  });
});