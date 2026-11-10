import { describe, expect, it } from 'vitest';
import { activityResult, mergeRetry, testResult, type ItemResult, type TestItemResult } from '../../src/assessment';

// n scored items followed by (total - n) missed ones, with ids q1, q2, ...
function items(scored: number, total: number): ItemResult[] {
  return Array.from({ length: total }, (_, i) => ({ id: `q${i + 1}`, scored: i < scored }));
}

describe('end-of-lesson activity result', () => {
  it('passes at 80% or more', () => {
    expect(activityResult(items(5, 5)).band).toBe('pass');
    expect(activityResult(items(4, 5)).band).toBe('pass'); // exactly 80%
    expect(activityResult(items(5, 6)).band).toBe('pass'); // 83%
  });

  it('gives the middle band from 60% to 79%', () => {
    expect(activityResult(items(3, 5)).band).toBe('mid'); // exactly 60%
    expect(activityResult(items(4, 6)).band).toBe('mid'); // 67%
  });

  it('gives the low band below 60%', () => {
    expect(activityResult(items(2, 5)).band).toBe('low'); // 40%
    expect(activityResult(items(3, 6)).band).toBe('low'); // 50%
  });

  it('lists the missed items in order', () => {
    expect(activityResult(items(4, 6)).missed).toEqual(['q5', 'q6']);
  });

  it('refuses an empty activity', () => {
    expect(() => activityResult([])).toThrow();
  });

  describe('Lesson 5 rule: one correct item per delete case', () => {
    const lesson5 = (scored: boolean[]): ItemResult[] => {
      const cases = ['leaf', 'one', 'two', 'two', undefined, undefined] as const;
      return cases.map((deleteCase, i) => ({ id: `L5-Q${i + 1}`, scored: scored[i] ?? false, deleteCase }));
    };

    it('passes when every case has a correct item', () => {
      const r = activityResult(lesson5([true, true, false, true, true, true]), { requireEachDeleteCase: true });
      expect(r.band).toBe('pass');
      expect(r.caseRuleMet).toBe(true);
    });

    it('drops a pass to the middle band when a case has no correct item', () => {
      // 6 of 7 (86%), but the only two-children item is wrong.
      const r = activityResult([
        { id: 'a', scored: true, deleteCase: 'leaf' },
        { id: 'b', scored: true, deleteCase: 'one' },
        { id: 'c', scored: false, deleteCase: 'two' },
        { id: 'd', scored: true }, { id: 'e', scored: true }, { id: 'f', scored: true }, { id: 'g', scored: true },
      ], { requireEachDeleteCase: true });
      expect(r.caseRuleMet).toBe(false);
      expect(r.band).toBe('mid');
    });

    it('with the current six items, missing both two-children items is already below 80%', () => {
      const r = activityResult(lesson5([true, true, false, false, true, true]), { requireEachDeleteCase: true });
      expect(r.caseRuleMet).toBe(false);
      expect(r.band).toBe('mid'); // 4 of 6 = 67%
    });

    it('reports the case rule as not applicable for other lessons', () => {
      expect(activityResult(items(5, 5)).caseRuleMet).toBeNull();
    });
  });
});

describe('merging a retry into the first attempt', () => {
  it('marks an item scored when the retry scores it', () => {
    const base = items(3, 5);
    const retry: ItemResult[] = [{ id: 'q4', scored: true }, { id: 'q5', scored: false }];
    const merged = mergeRetry(base, retry);
    expect(merged.map((i) => i.scored)).toEqual([true, true, true, true, false]);
    expect(activityResult(merged).band).toBe('pass');
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

describe('final test result', () => {
  // The ten final-test items mapped to their outcomes, as in the lesson plan.
  const OUTCOMES = ['LO1', 'LO2', 'LO2', 'LO3', 'LO4', 'LO4', 'LO5', 'LO5', 'LO6', 'LO6'] as const;
  const test = (correct: boolean[]): TestItemResult[] =>
    OUTCOMES.map((outcome, i) => ({ id: `T${i + 1}`, outcome, correct: correct[i] ?? false }));
  const allBut = (...wrong: number[]) => OUTCOMES.map((_, i) => !wrong.includes(i + 1));

  it('uses the team bands: Excellent 9-10, Good 7-8, Satisfactory 5-6, Limited 0-4', () => {
    expect(testResult(test(allBut())).descriptor).toBe('Excellent');
    expect(testResult(test(allBut(10))).descriptor).toBe('Excellent');
    expect(testResult(test(allBut(9, 10))).descriptor).toBe('Good');
    expect(testResult(test(allBut(8, 9, 10))).descriptor).toBe('Good');
    expect(testResult(test(allBut(7, 8, 9, 10))).descriptor).toBe('Satisfactory');
    expect(testResult(test(allBut(6, 7, 8, 9, 10))).descriptor).toBe('Satisfactory');
    expect(testResult(test(allBut(5, 6, 7, 8, 9, 10))).descriptor).toBe('Limited');
    expect(testResult(test([])).descriptor).toBe('Limited');
  });

  it('reports the score out of the number of items', () => {
    const r = testResult(test(allBut(2, 9)));
    expect(r.score).toBe(8);
    expect(r.total).toBe(10);
  });

  it('marks an outcome secure only when every item for it is correct', () => {
    const r = testResult(test(allBut(3, 10))); // one LO2 item and one LO6 item wrong
    expect(r.outcomes).toEqual({
      LO1: 'secure', LO2: 'listen', LO3: 'secure', LO4: 'secure', LO5: 'secure', LO6: 'listen',
    });
  });

  it('suggests a lecture question for the first outcome that is not secure', () => {
    expect(testResult(test(allBut(3, 10))).weakest).toBe('LO2');
    expect(testResult(test(allBut())).weakest).toBeNull();
  });
});
