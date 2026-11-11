/**
empty spots (Lessons 1 and 3).
 Where a new key could be placed, and which keys would keep the tree valid
 there (the "allowed range" bubble in Lesson 1's guided practice).
 */
import { assertWholeNumber } from './keys';
import type { Side, Slot, Tree, TreeNode } from './types';

// Every empty child position, left to right. An empty tree has one: the root.
export function emptySlots(tree: Tree): Slot[] {
if (tree === null) return [{ parent: null, side: null }];
  const slots: Slot[] = [];
 
  function walk(node: TreeNode): void {
    if (node.left === null) slots.push({ parent: node.key, side: 'left' });
    else walk(node.left);
    if (node.right === null) slots.push({ parent: node.key, side: 'right' });
    else walk(node.right);
  }
 
  walk(tree);
  return slots;
}

interface Turn {
  key: number;
  went: Side;
}

function routeTo(tree: Tree, key: number, turns: Turn[] = []): { node: TreeNode; turns: Turn[] } | null {
  if (tree === null) return null;
  if (tree.key === key) return { node: tree, turns };
  return (
    routeTo(tree.left, key, [...turns, { key: tree.key, went: 'left' }]) ??
    routeTo(tree.right, key, [...turns, { key: tree.key, went: 'right' }])
  );
}

/**
  The whole-number keys that may go in a slot without breaking the BST rule,
  as an inclusive range. In tree T, the empty spot left of 70 allows 51 to 69.
  Ends are null when unbounded.
 */
export function allowedRange(tree: Tree, slot: Slot): { lo: number | null; hi: number | null } {
  if (slot.parent === null) {
    if (tree !== null || slot.side !== null) {
      throw new RangeError('The root spot is only empty in an empty tree');
    }
    return { lo: null, hi: null };
  }
 
  assertWholeNumber(slot.parent);
  if (slot.side !== 'left' && slot.side !== 'right') {
    throw new RangeError(`A slot's side must be 'left' or 'right', but got ${String(slot.side)}`);
  }
 
  const found = routeTo(tree, slot.parent);
  if (found === null) {
    throw new RangeError(`${slot.parent} is not in the tree`);
  }
  if (found.node[slot.side] !== null) {
    throw new RangeError(`The ${slot.side} of ${slot.parent} is not empty`);
  }
 
  // Each left turn caps the keys from above, each right turn from below.
  // The limits only ever narrow, as in checkBST.
  let below: number | null = null; // keys must be larger than this
  let above: number | null = null; // keys must be smaller than this
  for (const { key, went } of [...found.turns, { key: slot.parent, went: slot.side }]) {
    if (went === 'left') above = above === null ? key : Math.min(above, key);
    else below = below === null ? key : Math.max(below, key);
  }
 
  return {
    lo: below === null ? null : below + 1,
    hi: above === null ? null : above - 1,
  };
}