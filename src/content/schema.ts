/**
  The shapes of the content: what the JSON files hold, and what the
  resolver hands to the lessons and assessment screens.
 
  The JSON stores each question's TASK ("search T for 65"), never its answer.
  The resolver asks the engine for the answer, so answers can't be mistyped,
  and retakes with new keys stay correct automatically.
 */
import type { DeleteCase, Shape, Slot, Tree } from '../engine';
import type { Highlight, Step } from '../engine';

// for config.json
export interface ContentConfig {
  // Share of items needed to pass an activity (0.8 = 80%).
  passThreshold: number;
  // Lower edge of the middle band: from here up to the pass mark, retry the missed items.
  middleBand: number;
  // Rungs on the hint ladder: nudge, highlight, worked solution.
  hintRungs: number;
  // Whether an item still counts as correct once its worked solution has been shown.
  countCorrectAfterSolution: boolean;
  // Lesson 5 also needs one correct item for each delete case.
  lesson5NeedsEveryDeleteCase: boolean;
  // Key shift for each retake. Retake 0 is the original keys, so the first offset is 0.
  retakeOffsets: number[];
  // Smallest and largest key allowed after shifting, inclusive.
  keyRange: [number, number];
}

// for trees.json 

// A named tree: built by inserting keys in order, or drawn exactly as a shape (for invalid trees).
export type TreeSpec = { insert: number[] } | { shape: Shape };

export type TreeLibrary = Record<string, TreeSpec>;

//  what the screens receive 

export type Outcome = 'LO1' | 'LO2' | 'LO3' | 'LO4' | 'LO5' | 'LO6';
export type LessonId = 1 | 2 | 3 | 4 | 5 | 'final';

// One answer part of a question. A question has one to three parts.
export type Part =
  | { type: 'pick'; label: string; options: string[]; answer: number }
  | { type: 'click'; label: string; mode: 'one'; answer: number }
  // Any order counts.
  | { type: 'click'; label: string; mode: 'set'; answer: number[] }
  // Must be in this order.
  | { type: 'click'; label: string; mode: 'path'; answer: number[] }
  | { type: 'order'; label: string; cards: number[]; answer: number[] }
  // Place `keys` one at a time; `answer[i]` is the empty spot for `keys[i]`, in the tree as it grows.
  | { type: 'place'; label: string; keys: number[]; answer: Slot[] };

export interface Question {
  id: string;
  lesson: LessonId;
  outcome: Outcome;
  // Which retake this is: 0 is the original keys.
  retake: number;
  prompt: string;
  tree: Tree;
  parts: Part[];
  // Rung 1 (a nudge question) and rung 2 (with a highlight). Rung 3 is 'solution'.
  hints: { text: string; highlight?: Highlight }[];
  explanation: string;
  // Rung 3: the worked solution, as animation steps.
  solution: Step[];
  // Lesson 5 items: which delete case this tests, for the one-of-each-case pass rule.
  deleteCase?: DeleteCase;
  // The misconception a wrong answer most likely shows, for targeted feedback.
  misconception?: string;
}