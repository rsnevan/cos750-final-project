/**
  The shape of a lesson file (`data/lessonN.json`) and of the ready-to-show
  lesson the screens receive from `getLesson`.
 
  A lesson has the six stages from the lesson plan: hook and recall, explore,
  explain, worked examples, try it, and the end-of-lesson activity.
 
  Stage content is always shown with the original keys, so stage text uses
  plain numbers ("Search for 60"). Only the activity changes keys on a retake,
  so only activity items use `{60}`. The loader rejects braces in stage text,
  so the two can't be mixed up.
 
  Interactive stages (the explore activities and the try-it) are screens
  Nevan builds; the file holds their wording and settings, and the loader
  works out their trees and answers from the engine.
  */
 
import type { DeleteCase, Highlight, Slot, Step, TraversalOrder, Tree } from '../engine';
import type { ItemSpec, Outcome, TreeRef } from './schema';

export type LessonNumber = 1 | 2 | 3 | 4 | 5;
export type PseudocodeName = 'search' | 'insert' | 'traverse' | 'delete';

// An option in a multiple-choice question with a reply for each choice. 
export interface ChoiceOption {
  text: string;
  // Shown when this option is chosen. 
  reply: string;
}

// A tree drawn on a stage. Keys in `highlight` are plain (stages never change keys). 
export interface DiagramSpec {
  tree: TreeRef;
  highlight?: Highlight;
}

//  stage 1: hook and recall 

export interface HookSpec {
  goal: string;
  scenario: { title: string; text: string; recall?: string; reveal?: string };
  // A recall question before the lesson starts; every option has its own reply. 
  warmUp: { question: string; tree?: TreeRef; options: ChoiceOption[]; answer: number };
  bridge?: string;
}

//  stage 2: explore 

// What a deleteTry option does to the tree. 
export type DeleteTryResult =
  // The engine's delete: the right way. 
  | 'delete'
  // A tree drawn exactly, such as a wrong move. 
  | { shape: import('../engine').Shape }
  // Not possible: leaving a gap would cut off the node's children. 
  | null;

export type ExploreSpec =
  // Lesson 1: click nodes to see each one's relatives light up, `need` times. 
  | { kind: 'relatives'; tree: TreeRef; need: number }
  // Lesson 1: predict which tree lets a search always choose a side. 
  | { kind: 'pickTree'; prompt: string; trees: { label: string; tree: TreeRef }[]; answer: number; reveal: string }
  // Lesson 2: search for `key` by clicking the next node each time, with no hints. 
  | { kind: 'freeSearch'; tree: TreeRef; key: number }
  // Lesson 3: drop `key` onto any empty spot; the app then searches for it. 
  | { kind: 'slotProbe'; tree: TreeRef; key: number }
  // Lesson 4: watch a marker walk round the tree. 
  | { kind: 'walk'; tree: TreeRef }
  // Lesson 4: put the node cards in the order the marker visited them. 
  | { kind: 'orderGuess'; tree: TreeRef; order: TraversalOrder }
  // Lesson 5: try to remove a node, one case at a time, choosing how to close the gap. 
  | {
      kind: 'deleteTry';
      cases: {
        label: string;
        tree: TreeRef;
        key: number;
        options: { text: string; result: DeleteTryResult }[];
        note?: string;
      }[];
    }
  // A reflection question. `answer: null` means every option is fine and only the replies differ. 
  | { kind: 'reflect'; prompt: string; options: ChoiceOption[]; answer: number | null };

//  stage 3: explain 

export interface ExplainPageSpec {
  title: string;
  // Vocabulary in small groups (Lesson 1). 
  terms?: { group: string; items: { term: string; meaning: string }[] }[];
  // The explanation as short steps. 
  steps?: string[];
  note?: string;
  diagram?: DiagramSpec;
  caption?: string;
  pseudocode?: PseudocodeName;
}

//  stage 4: worked examples 

// Animation steps from an engine builder, or one written step. 
export type StepSpec =
  | { search: { tree: TreeRef; key: number } }
  | { insert: { tree: TreeRef; key: number } }
  | { build: number[] }
  | { extreme: { tree: TreeRef; which: 'min' | 'max'; from?: number } }
  | { traversal: { tree: TreeRef; order: TraversalOrder; from?: number } }
  | { walk: { tree: TreeRef } }
  | { delete: { tree: TreeRef; key: number } }
  | { tree: TreeRef; highlight?: Highlight; text: string };

export interface WorkedExampleSpec {
  label: string;
  // Lesson 5: the case this example shows, checked against the engine. 
  deleteCase?: DeleteCase;
  // The pseudocode shown beside the animation, if any. 
  pseudocode?: PseudocodeName;
  // One or more step specs, played one after another. 
  steps: StepSpec[];
}

//  stage 5: try it 

// Which nodes a guided step accepts: worked out from the tree, or written keys. 
export type NodeFact = 'root' | 'leaves' | { parentOf: number } | { successorOf: number } | number[];

export type GuidedStepSpec =
  | {
      ask: 'node';
      prompt: string;
      answer: NodeFact;
      // A label put on the clicked node once it's right, such as "root". 
      tag?: string;
      highlight?: Highlight;
      right: string;
      wrong: string;
    }
  | {
      ask: 'choice';
      prompt: string;
      options: string[];
      answer: number;
      highlight?: Highlight;
      // Show the keys allowed in the highlight's `slot` (the "allowed range" bubble). 
      showRange?: boolean;
      right: string;
      wrong: string;
      // The tree to show once the step is answered. 
      after?: DiagramSpec;
    };

export type TryItSpec =
  | { kind: 'search'; title: string; tree: TreeRef; key: number }
  | { kind: 'insert'; title: string; tree: TreeRef; key: number }
  | { kind: 'traversal'; title: string; tree: TreeRef; order: TraversalOrder; from?: number }
  | { kind: 'guided'; title: string; tree: TreeRef; steps: GuidedStepSpec[] };

//  the lesson file 

export interface LessonSpec {
  lesson: LessonNumber;
  title: string;
  short: string;
  minutes: number;
  outcomes: Outcome[];
  summary: string;
  hook: HookSpec;
  explore: ExploreSpec[];
  explain: { pages: ExplainPageSpec[] };
  worked: { examples: WorkedExampleSpec[] };
  tryIt: TryItSpec;
  activity: { title: string; items: ItemSpec[] };
}

//  what the screens receive 

export interface Diagram {
  tree: Tree;
  highlight: Highlight;
}

export interface Pseudocode {
  name: PseudocodeName;
  lines: readonly string[];
}

export type Explore =
  | { kind: 'relatives'; tree: Tree; need: number }
  | { kind: 'pickTree'; prompt: string; trees: { label: string; tree: Tree }[]; answer: number; reveal: string }
  // `path` is the search path the student should click. 
  | { kind: 'freeSearch'; tree: Tree; key: number; path: number[] }
  // `slot` is where the key belongs. 
  | { kind: 'slotProbe'; tree: Tree; key: number; slot: Slot }
  | { kind: 'walk'; tree: Tree; steps: Step[] }
  // `answer` is the traversal sequence. 
  | { kind: 'orderGuess'; tree: Tree; order: TraversalOrder; answer: number[] }
  | {
      kind: 'deleteTry';
      cases: {
        label: string;
        tree: Tree;
        key: number;
        deleteCase: DeleteCase;
        // `result` is the tree after the move, or null if the move is impossible; `valid` says if it keeps the BST rule.
        options: { text: string; result: Tree; valid: boolean; possible: boolean }[];
        note?: string;
      }[];
    }
  | { kind: 'reflect'; prompt: string; options: ChoiceOption[]; answer: number | null };

export type GuidedStep =
  | {
      ask: 'node';
      prompt: string;
      // Every key that counts as right.
      accept: number[];
      tag?: string;
      highlight: Highlight;
      right: string;
      wrong: string;
    }
  | {
      ask: 'choice';
      prompt: string;
      options: string[];
      answer: number;
      highlight: Highlight;
      right: string;
      wrong: string;
      after?: Diagram;
    };

export type TryIt =
  // Click the search path; `path` is the answer.
  | { kind: 'search'; title: string; tree: Tree; key: number; path: number[]; found: boolean; solution: Step[] }
  // Click the search path, then place the key; `slot` is where it goes.
  | { kind: 'insert'; title: string; tree: Tree; key: number; path: number[]; slot: Slot; solution: Step[] }
  // Click the nodes in traversal order; `sequence` is the answer.
  | {
      kind: 'traversal';
      title: string;
      tree: Tree;
      order: TraversalOrder;
      from?: number;
      sequence: number[];
      solution: Step[];
    }
  | { kind: 'guided'; title: string; tree: Tree; steps: GuidedStep[] };

export interface Lesson {
  lesson: LessonNumber;
  title: string;
  short: string;
  minutes: number;
  outcomes: Outcome[];
  summary: string;
  hook: {
    goal: string;
    scenario: { title: string; text: string; recall?: string; reveal?: string };
    warmUp: { question: string; tree?: Tree; options: ChoiceOption[]; answer: number };
    bridge?: string;
  };
  explore: Explore[];
  explain: {
    pages: {
      title: string;
      terms?: { group: string; items: { term: string; meaning: string }[] }[];
      steps?: string[];
      note?: string;
      diagram?: Diagram;
      caption?: string;
      pseudocode?: Pseudocode;
    }[];
  };
  worked: { examples: { label: string; deleteCase?: DeleteCase; pseudocode?: Pseudocode; steps: Step[] }[] };
  tryIt: TryIt;
  // The activity's items; `activityQuestions` resolves them for a retake.
  activity: { title: string; items: ItemSpec[] };
}