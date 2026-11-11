/**
  Applying the pass rules to an end-of-lesson activity (lesson plan: pass
  rules and remediation). The rules' values live in the content config; the
  final test's results come from finalResults in src/content.

  No mark is ever shown to the student: the band only chooses what the app
  does next.
 */
import type { DeleteCase } from '../engine';
import { CONFIG, type ContentConfig } from '../content';
import type { LessonNumber } from './progress';

export interface ItemResult {
  readonly id: string;
  readonly scored: boolean;
  // Lesson 5 only: the question's deleteCase.
  readonly deleteCase?: DeleteCase;
}

// pass: next lesson unlocks. mid: explain missed items, retry them. low: re-explain the lesson, retry all.
export type Band = 'pass' | 'mid' | 'low';

export interface ActivityResult {
  readonly band: Band;
  // Lesson 5 rule: true or false when it applies, null otherwise.
  readonly caseRuleMet: boolean | null;
  // Ids of items not scored, in order.
  readonly missed: readonly string[];
}

const DELETE_CASES: readonly DeleteCase[] = ['leaf', 'one', 'two'];
// Guards against floating-point error, e.g. 4 / 5 vs 0.8.
const EPSILON = 1e-9;

export function activityResult(
  items: readonly ItemResult[],
  lesson: LessonNumber,
  config: ContentConfig = CONFIG,
): ActivityResult {
  if (items.length === 0) throw new Error('An activity needs at least one item');

  const ratio = items.filter((i) => i.scored).length / items.length;
  const caseRuleMet =
    lesson === 5 && config.lesson5NeedsEveryDeleteCase
      ? DELETE_CASES.every((c) => items.some((i) => i.deleteCase === c && i.scored))
      : null;

  let band: Band;
  if (ratio + EPSILON >= config.passThreshold) band = caseRuleMet === false ? 'mid' : 'pass';
  else if (ratio + EPSILON >= config.middleBand) band = 'mid';
  else band = 'low';

  return { band, caseRuleMet, missed: items.filter((i) => !i.scored).map((i) => i.id) };
}

/**
  Fold a retry of the missed items back into the first attempt. An item is
  scored if either attempt scored it, so a pass after a retry counts the same
  as a first-time pass (the retry uses new keys).
 */
export function mergeRetry(base: readonly ItemResult[], retry: readonly ItemResult[]): ItemResult[] {
  const ids = new Set(base.map((i) => i.id));
  for (const r of retry) {
    if (!ids.has(r.id)) throw new Error(`Retry item ${r.id} is not in the first attempt`);
  }
  const retried = new Set(retry.filter((r) => r.scored).map((r) => r.id));
  return base.map((i) => (i.scored || !retried.has(i.id) ? i : { ...i, scored: true }));
}
