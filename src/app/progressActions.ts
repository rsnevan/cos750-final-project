/**
  The two calls the lesson and test screens make when a student finishes
  something. They update progress, save it and record the attempt in one
  step, so no screen has to remember to save.
 */
import { applyActivity, completeTest } from '../assessment';
import type { ActivityResult, LessonNumber } from '../assessment';
import type { AppContext } from './context';

// Call when an end-of-lesson activity is scored. Returns true if this
// attempt unlocked something new (to show the badge celebration).
export function finishActivity(ctx: AppContext, lesson: LessonNumber, result: ActivityResult): boolean {
  const before = ctx.store.load().progress;
  const after = applyActivity(before, lesson, result);
  ctx.store.saveProgress(after);
  ctx.store.recordAttempt({ lesson, band: result.band, missed: result.missed });
  return after !== before;
}

// Call when the student reaches the end of the final test.
export function finishFinalTest(ctx: AppContext, missed: readonly string[]): void {
  ctx.store.saveProgress(completeTest(ctx.store.load().progress));
  ctx.store.recordAttempt({ lesson: 'final', band: null, missed });
}
