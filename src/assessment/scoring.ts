/**
  Scoring for end-of-lesson activities and the final test (lesson plan:
  assessment schedule, pass rules and final test descriptors).

  No mark is ever shown to the student: these results only choose what the
  app does next and which descriptor the results screen uses.
 */
import type { DeleteCase } from '../engine';
import { CONFIG, type AssessmentConfig, type Descriptor } from './config';

export type OutcomeId = 'LO1' | 'LO2' | 'LO3' | 'LO4' | 'LO5' | 'LO6';
export const OUTCOME_IDS: readonly OutcomeId[] = ['LO1', 'LO2', 'LO3', 'LO4', 'LO5', 'LO6'];

// ---- End-of-lesson activities ----

export interface ItemResult {
  readonly id: string;
  readonly scored: boolean;
  // Lesson 5 only: which delete case the item tests.
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

export interface ActivityOptions {
  // Lesson 5: at least one scored item for each of the three delete cases (decision 17).
  readonly requireEachDeleteCase?: boolean;
}

const DELETE_CASES: readonly DeleteCase[] = ['leaf', 'one', 'two'];
// Guards against floating-point error, e.g. 0.6 * 5 or 4 / 5 vs 0.8.
const EPSILON = 1e-9;

export function activityResult(
  items: readonly ItemResult[],
  options: ActivityOptions = {},
  config: AssessmentConfig = CONFIG,
): ActivityResult {
  if (items.length === 0) throw new Error('An activity needs at least one item');

  const ratio = items.filter((i) => i.scored).length / items.length;
  const caseRuleMet = options.requireEachDeleteCase
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

// ---- Final test ----

export interface TestItemResult {
  readonly id: string;
  readonly outcome: OutcomeId;
  readonly correct: boolean;
}

export type OutcomeStatus = 'secure' | 'listen';

export interface TestResult {
  readonly score: number;
  readonly total: number;
  readonly descriptor: Descriptor;
  // secure when every item for the outcome is correct, otherwise "listen for this in the lecture".
  readonly outcomes: Readonly<Record<OutcomeId, OutcomeStatus>>;
  // First outcome that is not secure, used to pick a question to bring to the lecture.
  readonly weakest: OutcomeId | null;
}

export function testResult(items: readonly TestItemResult[], config: AssessmentConfig = CONFIG): TestResult {
  const score = items.filter((i) => i.correct).length;
  const band = config.descriptorBands.find((b) => score >= b.min);
  if (!band) throw new Error(`No descriptor band covers a score of ${score}`);

  const outcomes = {} as Record<OutcomeId, OutcomeStatus>;
  for (const id of OUTCOME_IDS) {
    outcomes[id] = items.filter((i) => i.outcome === id).every((i) => i.correct) ? 'secure' : 'listen';
  }
  const weakest = OUTCOME_IDS.find((id) => outcomes[id] === 'listen') ?? null;

  return { score, total: items.length, descriptor: band.descriptor, outcomes, weakest };
}
