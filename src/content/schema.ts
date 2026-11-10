/** 
  The shapes of the content: what the JSON files hold, and what the
  resolver hands to the lessons and assessment screens.
 
  The JSON stores each question's TASK ("search T for 65"), never its answer.
  The resolver asks the engine for the answer, so answers can't be mistyped,
  and retakes with new keys stay correct automatically.
    */
import type { DeleteCase, Shape, Slot, Tree } from '../engine';
import type { Highlight, Step } from '../engine';

//  config.json 

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

//  trees.json 

// A named tree: built by inserting keys in order, or drawn exactly as a shape (for invalid trees). 
export type TreeSpec = { insert: number[] } | { shape: Shape };

export type TreeLibrary = Record<string, TreeSpec>;

export type Outcome = 'LO1' | 'LO2' | 'LO3' | 'LO4' | 'LO5' | 'LO6';
export type LessonId = 1 | 2 | 3 | 4 | 5 | 'final';

//  lesson items (what the lesson JSON holds) 

/*
 What a question asks. Keys are written as in retake 0; the resolver shifts
 them and asks the engine for the answer.
 */
export type AskSpec =
  // Click the nodes a search visits, in order, then say found or not found. 
  | { kind: 'searchPath'; key: number }
  // Click the node whose empty side ends an unsuccessful search, then say which side. 
  | { kind: 'searchEnd'; key: number }
  // The most nodes a search can visit in the tree: its height + 1. 
  | { kind: 'maxVisits' }
  // Nothing to work out: the item writes its own parts and answers. 
  | { kind: 'fixed' };

export type AskKind = AskSpec['kind'];

/*
  A rung-2 highlight worked out from the item's tree and key:
  - `path`: the nodes and edges a search for the key visits
  - `otherHalf`: dims the half of the tree, below the root, that can't hold the key
  - `emptySpot`: the empty spot where an unsuccessful search stops
  - `longestPath`: the edges of the leftmost longest path from the root down to a leaf
 */
export type HighlightPreset = 'path' | 'otherHalf' | 'emptySpot' | 'longestPath';

export interface HintSpec {
  text: string;
  // A preset name, or a highlight written out with retake-0 keys (shifted like everything else). 
  highlight?: HighlightPreset | Highlight;
}

/**
  An answer part written in the item, replacing the task's default parts.
  A click answer is either written keys, or the name of a value the task
  works out, such as `"path"` or `"endAt"`.
 */
export type PartSpec =
  | { type: 'pick'; label?: string; options: string[]; answer: number; shuffle?: boolean }
  | { type: 'click'; label?: string; mode: 'one'; answer: number | string }
  | { type: 'click'; label?: string; mode: 'set' | 'path'; answer: number[] | string };

export interface ItemSpec {
  // Unique across all lessons; saved progress stores this with the retake number. 
  id: string;
  outcome: Outcome;
  // A name from `trees.json`. 
  tree: string;
  ask: AskSpec;
  // A short line shown above the prompt, such as "Predict first, then check." 
  intro?: string;
  prompt: string;
  // Leave out to use the task's default parts. Required for `fixed`. 
  parts?: PartSpec[];
  // Rung 1 and rung 2. 
  hints: HintSpec[];
  explanation: string;
  misconception?: string;
}

//  what the screens receive 

// One answer part of a question. A question has one to three parts. `label` may be empty. 
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
  intro?: string;
  prompt: string;
  tree: Tree;
  parts: Part[];
  // Rung 1 (a nudge question) and rung 2 (with a highlight). Rung 3 is `solution`. 
  hints: { text: string; highlight?: Highlight }[];
  explanation: string;
  // Rung 3: the worked solution, as animation steps. 
  solution: Step[];
  // Lesson 5 items: which delete case this tests, for the one-of-each-case pass rule. 
  deleteCase?: DeleteCase;
  // The misconception a wrong answer most likely shows, for targeted feedback. 
  misconception?: string;
}