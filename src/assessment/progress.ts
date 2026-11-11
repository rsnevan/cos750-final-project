/**
  Lesson progress, unlocking and badges (lesson plan: lesson map, pass rules,
  motivation).

  - Lessons unlock in order; any earlier lesson can be revisited at any time.
  - Passing a lesson's activity unlocks the next lesson and awards its badge.
    A later weak result never re-locks anything.
  - The final test unlocks after Lesson 5. Finishing it awards "BST ready",
    whatever the score: badges recognise finishing, never a mark.

  Progress is a plain, serialisable object so the integration role can save
  it as it is. Every function returns a new object and never changes its input.
 */
import type { LessonId } from '../content';
import type { ActivityResult } from './scoring';

// The five lessons: the content's LessonId without the final test.
export type LessonNumber = Exclude<LessonId, 'final'>;
export const LESSON_NUMBERS: readonly LessonNumber[] = [1, 2, 3, 4, 5];

export type Badge = `lesson-${LessonNumber}` | 'bst-ready';

export interface Progress {
  // Lessons whose activity has been passed, in ascending order.
  readonly passed: readonly LessonNumber[];
  // Badges in the order they were earned.
  readonly badges: readonly Badge[];
  readonly testCompleted: boolean;
}

// Where the "Continue" button on the overview should take the student.
export type NextStep =
  | { readonly kind: 'lesson'; readonly lesson: LessonNumber }
  | { readonly kind: 'test' }
  | { readonly kind: 'done' };

const LAST_LESSON: LessonNumber = 5;

export function newProgress(): Progress {
  return { passed: [], badges: [], testCompleted: false };
}

export function isLessonUnlocked(progress: Progress, lesson: LessonNumber): boolean {
  return lesson === 1 || progress.passed.includes((lesson - 1) as LessonNumber);
}

export function isTestUnlocked(progress: Progress): boolean {
  return progress.passed.includes(LAST_LESSON);
}

// Apply an end-of-lesson activity result. Only a pass changes anything.
export function applyActivity(progress: Progress, lesson: LessonNumber, result: ActivityResult): Progress {
  if (!isLessonUnlocked(progress, lesson)) throw new Error(`Lesson ${lesson} is still locked`);
  if (result.band !== 'pass' || progress.passed.includes(lesson)) return progress;
  return {
    ...progress,
    passed: [...progress.passed, lesson].sort((a, b) => a - b),
    badges: addBadge(progress.badges, `lesson-${lesson}`),
  };
}

// Record that the final test was finished.
export function completeTest(progress: Progress): Progress {
  if (!isTestUnlocked(progress)) throw new Error('The final test is still locked');
  return { ...progress, testCompleted: true, badges: addBadge(progress.badges, 'bst-ready') };
}

export function nextStep(progress: Progress): NextStep {
  const lesson = LESSON_NUMBERS.find((l) => !progress.passed.includes(l));
  if (lesson !== undefined) return { kind: 'lesson', lesson };
  return progress.testCompleted ? { kind: 'done' } : { kind: 'test' };
}

function addBadge(badges: readonly Badge[], badge: Badge): readonly Badge[] {
  return badges.includes(badge) ? badges : [...badges, badge];
}
