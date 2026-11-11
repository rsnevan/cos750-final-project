import { describe, expect, it } from 'vitest';
import {
  activityResult,
  applyActivity,
  completeTest,
  isLessonUnlocked,
  isTestUnlocked,
  newProgress,
  nextStep,
  type ActivityResult,
  type LessonNumber,
  type Progress,
} from '../../src/assessment';

const pass: ActivityResult = activityResult([{ id: 'a', scored: true }], 1);
const mid: ActivityResult = activityResult([{ id: 'a', scored: true }, { id: 'b', scored: true }, { id: 'c', scored: true }, { id: 'd', scored: false }, { id: 'e', scored: false }], 1);
const low: ActivityResult = activityResult([{ id: 'a', scored: false }], 1);

// Progress after passing lessons 1..n in order.
function passedThrough(n: number): Progress {
  let p = newProgress();
  for (let l = 1; l <= n; l++) p = applyActivity(p, l as LessonNumber, pass);
  return p;
}

describe('progress', () => {
  it('starts with only Lesson 1 unlocked and no badges', () => {
    const p = newProgress();
    expect(p).toEqual({ passed: [], badges: [], testCompleted: false });
    expect(isLessonUnlocked(p, 1)).toBe(true);
    expect(isLessonUnlocked(p, 2)).toBe(false);
    expect(isTestUnlocked(p)).toBe(false);
  });

  it('unlocks the next lesson and awards a badge on a pass', () => {
    const p = applyActivity(newProgress(), 1, pass);
    expect(p.passed).toEqual([1]);
    expect(p.badges).toEqual(['lesson-1']);
    expect(isLessonUnlocked(p, 2)).toBe(true);
    expect(isLessonUnlocked(p, 3)).toBe(false);
  });

  it('changes nothing on a middle or low result', () => {
    expect(applyActivity(newProgress(), 1, mid)).toEqual(newProgress());
    expect(applyActivity(newProgress(), 1, low)).toEqual(newProgress());
  });

  it('keeps earlier lessons open to revisit, and a later weak result never re-locks them', () => {
    const p = applyActivity(passedThrough(3), 2, low);
    expect(p.passed).toEqual([1, 2, 3]);
    expect(isLessonUnlocked(p, 1)).toBe(true);
    expect(isLessonUnlocked(p, 4)).toBe(true);
  });

  it('awards each lesson badge only once', () => {
    const p = applyActivity(passedThrough(1), 1, pass);
    expect(p.badges).toEqual(['lesson-1']);
  });

  it('refuses a result for a lesson that is still locked', () => {
    expect(() => applyActivity(newProgress(), 3, pass)).toThrow();
  });

  it('unlocks the final test after Lesson 5', () => {
    expect(isTestUnlocked(passedThrough(4))).toBe(false);
    expect(isTestUnlocked(passedThrough(5))).toBe(true);
  });

  it('awards "BST ready" when the final test is finished, whatever the score', () => {
    const p = completeTest(passedThrough(5));
    expect(p.testCompleted).toBe(true);
    expect(p.badges).toContain('bst-ready');
    expect(completeTest(p).badges.filter((b) => b === 'bst-ready')).toHaveLength(1);
  });

  it('refuses to complete a test that is still locked', () => {
    expect(() => completeTest(passedThrough(4))).toThrow();
  });

  it('never changes the progress it is given', () => {
    const p = newProgress();
    applyActivity(p, 1, pass);
    expect(p).toEqual(newProgress());
  });

  describe('continue where you left off', () => {
    it('points to the first lesson not yet passed', () => {
      expect(nextStep(newProgress())).toEqual({ kind: 'lesson', lesson: 1 });
      expect(nextStep(passedThrough(2))).toEqual({ kind: 'lesson', lesson: 3 });
    });

    it('points to the final test after all five lessons', () => {
      expect(nextStep(passedThrough(5))).toEqual({ kind: 'test' });
    });

    it('reports done after the final test', () => {
      expect(nextStep(completeTest(passedThrough(5)))).toEqual({ kind: 'done' });
    });
  });
});
