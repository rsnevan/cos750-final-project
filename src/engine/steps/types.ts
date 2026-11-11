/**
  The shapes the animation player works with.
 
  Each step is a complete snapshot: a tree, what to highlight on it, one
  sentence and an optional pseudocode line. Back, Step and Replay only move
  through a list of steps, so the visualiser never does any BST logic itself.
 
  Division of work: the engine decides WHAT is highlighted (these fields);
  the visualiser decides HOW each one looks, always with a shape or label as
  well as colour. Add a field only by agreement with the visualiser.
 */
import type { Slot, Tree } from '../types';

// Where a moving marker sits on a node during a traversal (Lesson 4's "dots").
export type MarkerPosition = 'pre' | 'in' | 'post';

export interface Highlight {
  // Nodes visited so far, in order. The visualiser numbers them 1, 2, 3.
  readonly visited?: readonly number[];
  // The node being looked at right now. 
  readonly current?: number;
  // A node that was found, placed or chosen (a success highlight).
  readonly found?: number;
  // A node that breaks the BST rule.
  readonly offender?: number;
  // Nodes drawn outlined to draw attention, such as a node's children.
  readonly outlined?: readonly number[];
  // Nodes drawn faded, such as the half of the tree a search has ruled out.
  readonly dimmed?: readonly number[];
  //Parent-child edges to emphasise, as [parent key, child key].
  readonly edges?: readonly (readonly [number, number])[];
  // Short labels beside nodes, such as { 50: 'root', 20: 'leaf' }.
  readonly tags?: Readonly<Record<number, string>>;
  // An empty spot to point at: where a search stopped or a key will go.
  readonly slot?: Slot;
  // Show the traversal dots for this order on every node.
  readonly dots?: MarkerPosition | 'all';
  // A short label beside `slot`, such as the keys allowed there: "61 to 69".
  readonly slotLabel?: string;
  // Short labels on edges, as [parent key, child key, label], such as [50, 30, 'all smaller'].
  readonly edgeLabels?: readonly (readonly [number, number, string])[];
  // A marker passing one side of one node during a traversal.
  readonly marker?: { readonly key: number; readonly position: MarkerPosition };
  // The traversal sequence written so far.
  readonly output?: readonly number[];
  /** Show a node with a different key without changing the tree, as { from: to }.
    Used when delete copies the successor in: the tree never holds a key twice,
    even for one frame.
   */
  readonly relabel?: Readonly<Record<number, number>>;
  // A node drawn dashed because it is about to be removed (the old successor).
  readonly ghost?: number;
}

export interface Step {
  readonly tree: Tree;
  readonly highlight: Highlight;
  // One sentence. Shown on screen, announced to screen readers and read aloud by narration.
  readonly text: string;
  // Index into the matching `PSEUDOCODE` list, for the highlighted line.
  readonly line?: number;
}