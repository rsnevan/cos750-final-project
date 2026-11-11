/**
  The hint ladder's state for one activity item.

  Each wrong attempt climbs one rung: a nudge (the question's hints[0]), then
  a highlight (hints[1]), then the worked solution. Whether an item solved
  after the solution still counts is the content's rule (countsAsCorrect and
  countCorrectAfterSolution in src/content); this file only tracks the state.

  Item states are immutable: every function returns a new state.
 */
import { CONFIG, countsAsCorrect, type ContentConfig } from '../content';

export interface ItemState {
  readonly attempts: number; // wrong attempts so far
  readonly rung: number; // hint rungs shown: 0 to config.hintRungs
  readonly solved: boolean;
  readonly scored: boolean; // counts towards the pass mark
}

export type Feedback = 'none' | 'correct' | 'nudge' | 'highlight' | 'solution';

export function newItem(): ItemState {
  return { attempts: 0, rung: 0, solved: false, scored: false };
}

// Record one checked answer (from checkQuestion). Attempts after the item is solved are ignored.
export function recordAttempt(item: ItemState, correct: boolean, config: ContentConfig = CONFIG): ItemState {
  if (item.solved) return item;
  if (correct) return { ...item, solved: true, scored: countsAsCorrect(true, item.rung, config) };
  const attempts = item.attempts + 1;
  return { ...item, attempts, rung: Math.min(attempts, config.hintRungs) };
}

// What the feedback area should show for this item right now.
export function feedbackFor(item: ItemState, config: ContentConfig = CONFIG): Feedback {
  if (item.solved) return 'correct';
  if (item.rung === 0) return 'none';
  if (item.rung >= config.hintRungs) return 'solution';
  return item.rung === 1 ? 'nudge' : 'highlight';
}
