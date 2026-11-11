/**
  The shapes of the content: what the JSON files hold, and what the
  resolver hands to the lessons and assessment screens.
 
  The JSON stores each question's TASK ("search T for 65"), never its answer.
  The resolver asks the engine for the answer, so answers can't be mistyped,
  and retakes with new keys stay correct automatically.
 */
import type { DeleteCase, Shape, Slot, TraversalOrder, Tree } from '../engine';
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

// What a question asks. Keys are written as in retake 0; the resolver shifts them and asks the engine for the answer.
 
export type AskSpec =
  // ----- Lesson 1 -----
  // Click the root and every leaf (one click-set part); with `withHeight`, also pick the tree's height. 
  | { kind: 'rootAndLeaves'; withHeight?: boolean }
  // Pick the depth of `depthOf`, and/or the height of the subtree rooted at `heightOf`. 
  | { kind: 'depthHeight'; depthOf?: number; heightOf?: number }
  // Pick valid or invalid; if invalid, also click the node (or nodes) that break the BST rule. 
  | { kind: 'validity' }
  // ----- Lesson 2 -----
  // Click the nodes a search visits, in order, then say found or not found. 
  | { kind: 'searchPath'; key: number }
  // Click the node whose empty side ends an unsuccessful search, then say which side. 
  | { kind: 'searchEnd'; key: number }
  // The most nodes a search can visit in the tree: its height + 1. 
  | { kind: 'maxVisits' }
  // ----- Lesson 3 -----
  // Place a new key in the empty spot where it belongs. 
  | { kind: 'insertSlot'; key: number }
  // Place keys one at a time, starting from the item's tree, or an empty tree if it has none. 
  | { kind: 'build'; keys: number[] }
  // Click the minimum and/or maximum, in the order given, of the whole tree or the subtree rooted at `from`. 
  | { kind: 'minMax'; find: ('min' | 'max')[]; from?: number }
  // ----- Lesson 4 -----
  // Put cards in traversal order, for the whole tree or the subtree rooted at `from`. 
  | { kind: 'traversal'; order: TraversalOrder; from?: number }
  // ----- Lesson 5 -----
  /**
   * Delete `key`: pick the case, click the successor (with `successor: true`,
   * two-children case only), then pick the resulting tree from written options.
   */
  | { kind: 'delete'; key: number; successor?: boolean; result: { options: string[]; answer: number } }
  // Click the in-order successor of `key`. 
  | { kind: 'successor'; key: number }
  // ----- any lesson -----
  // Nothing to work out: the item writes its own parts and answers. 
  | { kind: 'fixed' };

export type AskKind = AskSpec['kind'];

/**
  A highlight worked out from the item's tree and task, for a hint or `base`:
  - `path`: the nodes and edges a search for the task's key visits
  - `otherHalf`: dims the half of the tree, below the root, that can't hold the key
  - `emptySpot`: the empty spot where an unsuccessful search for the key stops
  - `longestPath`: the edges of the leftmost longest path from the root down to a leaf
  - `leaves`: outlines every leaf
  - `depthHeight`: the edges from the root to `depthOf`, and the subtree rooted at `heightOf` outlined
  - `extremePaths`: the edges going left (for a minimum) and right (for a maximum) from the start node
  - `outsideSubtree`: dims everything outside the subtree rooted at `from` (or at the task's key)
  - `dots`: the traversal dots for the task's order
  - `children`: outlines the children of the task's key
  - `rightSubtree`: outlines the right subtree of the task's key and dims everything outside its subtree
 */
export type HighlightPreset =
  | 'path'
  | 'otherHalf'
  | 'emptySpot'
  | 'longestPath'
  | 'leaves'
  | 'depthHeight'
  | 'extremePaths'
  | 'outsideSubtree'
  | 'dots'
  | 'children'
  | 'rightSubtree';

/**
  The tree a question shows: a name from `trees.json`, or a named tree with
  keys inserted and then deleted first (retake-0 keys), such as
  `{ "from": "T", "delete": [50] }` for "T after deleting the root".
  */
 
export type TreeRef = string | { from: string; insert?: number[]; delete?: number[] };

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
  // Required, except for `build`, which starts from an empty tree when it has none. 
  tree?: TreeRef;
  ask: AskSpec;
  // Shown on the tree from the start, replacing the task's own (such as the dimmed tree outside a subtree). 
  base?: HighlightPreset | Highlight;
  // A short line shown above the prompt, such as "Predict first, then check." 
  intro?: string;
  prompt: string;
  // Leave out to use the task's default parts. Required for `fixed`. 
  parts?: PartSpec[];
  // Rung 1 and rung 2. 
  hints: HintSpec[];
  explanation: string;
  misconception?: string;
  // A line shown with the explanation that links to a later lesson, such as "Remember this one for delete." 
  bridge?: string;
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
  // Empty (`null`) only for a build from nothing. 
  tree: Tree;
  // Shown on the tree from the start. 
  base?: Highlight;
  parts: Part[];
  // Rung 1 (a nudge question) and rung 2 (with a highlight). Rung 3 is `solution`. 
  hints: { text: string; highlight?: Highlight }[];
  explanation: string;
  // Rung 3: the worked solution, as animation steps. Empty when the explanation says it all. 
  solution: Step[];
  // The tree to show once the answer is revealed, such as the tree after an insert or delete. 
  result?: { tree: Tree; highlight: Highlight };
  bridge?: string;
  // Lesson 5 items: which delete case this tests, for the one-of-each-case pass rule. 
  deleteCase?: DeleteCase;
  // The misconception a wrong answer most likely shows, for targeted feedback. 
  misconception?: string;
}