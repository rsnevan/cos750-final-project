/**
empty spots (Lessons 1 and 3).
 Where a new key could be placed, and which keys would keep the tree valid
 there (the "allowed range" bubble in Lesson 1's guided practice).
 */
import { NotImplementedError } from './errors';
import type { Slot, Tree } from './types';

// Every empty child position, left to right. An empty tree has one: the root.
export function emptySlots(tree: Tree): Slot[] {
  throw new NotImplementedError('emptySlots');
}

/**
  The whole-number keys that may go in a slot without breaking the BST rule,
  as an inclusive range. In tree T, the empty spot left of 70 allows 51 to 69.
  Ends are null when unbounded.
 */
export function allowedRange(tree: Tree, slot: Slot): { lo: number | null; hi: number | null } {
  throw new NotImplementedError('allowedRange');
}