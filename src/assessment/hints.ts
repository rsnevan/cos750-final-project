/**
  The hint ladder for one activity item.

  Each wrong attempt climbs one rung: a nudge question, then a highlight on
  the tree, then the worked solution (with a replay and a parallel item).
  An item counts as scored only if it is solved before the worked solution
  appears. (Team decision to confirm: the wireframe notes flag this.)

  Item states are immutable: every function returns a new state.
 */
import { CONFIG, type AssessmentConfig } from './config';

export interface ItemState {
  readonly attempts: number; // wrong attempts so far
  readonly rung: number; // 0 = no hint yet; capped at config.hintRungs
  readonly solved: boolean;
  readonly scored: boolean; // solved before the worked solution appeared
}

export type Feedback = 'none' | 'correct' | 'nudge' | 'highlight' | 'solution';

export function newItem(): ItemState {
  return { attempts: 0, rung: 0, solved: false, scored: false };
}

// Record one checked answer. Attempts after the item is solved are ignored.
export function recordAttempt(item: ItemState, correct: boolean, config: AssessmentConfig = CONFIG): ItemState {
  if (item.solved) return item;
  if (correct) return { ...item, solved: true, scored: item.rung < config.hintRungs };
  const attempts = item.attempts + 1;
  return { ...item, attempts, rung: Math.min(attempts, config.hintRungs) };
}

// What the feedback area should show for this item right now.
export function feedbackFor(item: ItemState, config: AssessmentConfig = CONFIG): Feedback {
  if (item.solved) return 'correct';
  if (item.rung === 0) return 'none';
  if (item.rung >= config.hintRungs) return 'solution';
  return item.rung === 1 ? 'nudge' : 'highlight';
}
