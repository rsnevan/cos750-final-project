import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/content';
import { activityResult, mergeRetry, type ItemResult } from '../../src/assessment';

// n scored items followed by (total - n) missed ones, with ids q1, q2, ...
function items(scored: number, total: number): ItemResult[] {
  return Array.from({ length: total }, (_, i) => ({ id: `q${i + 1}`, scored: i < scored }));
}

describe('end-of-lesson activity result', () => {
  it('passes at 80% or more', () => {
    expect(activityResult(items(5, 5), 1).band).toBe('pass');
    expect(activityResult(items(4, 5), 1).band).toBe('pass'); // exactly 80%
    expect(activityResult(items(5, 6), 1).band).toBe('pass'); // 83%
  });

  it('gives the middle band from 60% to 79%', () => {
    expect(activityResult(items(3, 5), 1).band).toBe('mid'); // exactly 60%
    expect(activityResult(items(4, 6), 1).band).toBe('mid'); // 67%
  });

  it('gives the low band below 60%', () => {
    expect(activityResult(items(2, 5), 1).band).toBe('low'); // 40%
    expect(activityResult(items(3, 6), 1).band).toBe('low'); // 50%
  });

  it('follows the pass mark in the content config', () => {
    expect(activityResult(items(3, 4), 1, { ...CONFIG, passThreshold: 0.75 }).band).toBe('pass');
  });

  it('lists the missed items in order', () => {
    expect(activityResult(items(4, 6), 1).missed).toEqual(['q5', 'q6']);
  });

  it('refuses an empty activity', () => {
    expect(() => activityResult([], 1)).toThrow();
  });

  describe('Lesson 5 rule: one correct item per delete case', () => {
    const lesson5 = (scored: boolean[]): ItemResult[] => {
      const cases = ['leaf', 'one', 'two', 'two', undefined, undefined] as const;
      return cases.map((deleteCase, i) => ({ id: `L5-Q${i + 1}`, scored: scored[i] ?? false, deleteCase }));
    };
    // 6 of 7 (86%), but the only two-children item is wrong.
    const missingCase: ItemResult[] = [
      { id: 'a', scored: true, deleteCase: 'leaf' },
      { id: 'b', scored: true, deleteCase: 'one' },
      { id: 'c', scored: false, deleteCase: 'two' },
      { id: 'd', scored: true }, { id: 'e', scored: true }, { id: 'f', scored: true }, { id: 'g', scored: true },
    ];

    it('passes when every case has a correct item', () => {
      const r = activityResult(lesson5([true, true, false, true, true, true]), 5);
      expect(r.band).toBe('pass');
      expect(r.caseRuleMet).toBe(true);
    });

    it('drops a pass to the middle band when a case has no correct item', () => {
      const r = activityResult(missingCase, 5);
      expect(r.caseRuleMet).toBe(false);
      expect(r.band).toBe('mid');
    });

    it('with the current six items, missing both two-children items is already below 80%', () => {
      const r = activityResult(lesson5([true, true, false, false, true, true]), 5);
      expect(r.caseRuleMet).toBe(false);
      expect(r.band).toBe('mid'); // 4 of 6 = 67%
    });

    it('does not apply when the content config turns it off', () => {
      const r = activityResult(missingCase, 5, { ...CONFIG, lesson5NeedsEveryDeleteCase: false });
      expect(r.caseRuleMet).toBeNull();
      expect(r.band).toBe('pass');
    });

    it('does not apply to other lessons', () => {
      expect(activityResult(missingCase, 4).caseRuleMet).toBeNull();
    });
  });
});

describe('merging a retry into the first attempt', () => {
  it('marks an item scored when the retry scores it', () => {
    const base = items(3, 5);
    const retry: ItemResult[] = [{ id: 'q4', scored: true }, { id: 'q5', scored: false }];
    const merged = mergeRetry(base, retry);
    expect(merged.map((i) => i.scored)).toEqual([true, true, true, true, false]);
    expect(activityResult(merged, 1).band).toBe('pass');
  });

  it('never un-scores an item and never changes the inputs', () => {
    const base = items(5, 5);
    const merged = mergeRetry(base, [{ id: 'q1', scored: false }]);
    expect(merged.every((i) => i.scored)).toBe(true);
    expect(base).toEqual(items(5, 5));
  });

  it('refuses a retry item that is not in the first attempt', () => {
    expect(() => mergeRetry(items(1, 2), [{ id: 'nope', scored: true }])).toThrow();
  });
});
