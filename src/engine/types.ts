/**
  Core shapes for the BST engine.
 
  Trees are immutable: engine functions return new trees and never change
  the tree they are given. That keeps animation frames and retries safe,
  because an old snapshot can never be changed by a later operation.
 
  Conventions (from the lesson plan, so every answer in the app matches it):
  - Keys are whole numbers, and duplicates are not allowed.
  - Height counts edges: a single node has height 0, the empty tree -1.
  - Deleting a node with two children uses the in-order successor.
 */

// One node of a tree. Fields are 'readonly', so a node can't change once made. 
export interface TreeNode {
  readonly key: number;
  readonly left: Tree;
  readonly right: Tree;
}

//  tree is its root node or null for empty tree.
export type Tree = TreeNode | null;

export type Side = 'left' | 'right';

// An empty spot where a new node could be attached.
export interface Slot {
  readonly parent: number | null;
  readonly side: Side | null;
}

//checking the BST rule (Lesson 1).
export interface BSTCheck {
  readonly valid: boolean;
  //The first node, in pre-order, that breaks the rule. null when valid.
  readonly offender: number | null;
}

// Searching (Lesson 2).
export interface SearchResult {
  // Keys visited, in the order the search visits them.
  readonly path: readonly number[];
  readonly found: boolean;
  // If not found: the last node visited, or null if the tree was empty.
  readonly endAt: number | null;
  // If not found: the empty side of endAt where the search stopped.
  readonly side: Side | null;
}

// Inserting (Lesson 3).
export interface InsertResult {
  readonly tree: Tree;
  // false when the key was already there, so nothing changed.
  readonly added: boolean;
}

export type DeleteCase = 'leaf' | 'one' | 'two';

// deleting a key (Lesson 5).
export interface DeleteResult {
  readonly tree: Tree;
  readonly case: DeleteCase | null;
  // Two-children case only: the in-order successor that took the key's place.
  readonly successor: number | null;
}



/**
  A tree written as nested arrays, used for trees that inserting can't make
  (the invalid trees in Lesson 1) and for readable test expectations.
 
  Canonical form, as produced by 'toShape':
  - leaf:            [key]
  - left child only: [key, left]
  - right child only:[key, null, right]
  - both children:   [key, left, right]
 */
export type Shape = readonly [number, (Shape | null)?, (Shape | null)?];