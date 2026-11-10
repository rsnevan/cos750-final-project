/**
the BST rule (Lesson 1).
For every node, every key in its left subtree is smaller and every key in
its right subtree is larger. The rule covers whole subtrees, so a node must
be checked against every ancestor, not only its parent.
 */
import type { BSTCheck, Tree } from './types';

function collectOffenders(tree: Tree, lo: number | null, hi: number | null, offenders: number[]): void {
  if (tree === null) return;
  const tooSmall = lo !== null && tree.key <= lo;
  const tooLarge = hi !== null && tree.key >= hi;
  if (tooSmall || tooLarge) offenders.push(tree.key);
  const leftHi = hi === null ? tree.key : Math.min(hi, tree.key);
  const rightLo = lo === null ? tree.key : Math.max(lo, tree.key);
  collectOffenders(tree.left, lo, leftHi, offenders);
  collectOffenders(tree.right, rightLo, hi, offenders);
}


//Every node that breaks the rule, in pre-order. Empty for a valid tree.
export function findOffenders(tree: Tree): number[] {
  const offenders: number[] = [];
  collectOffenders(tree, null, null, offenders);
  return offenders;
}


export function checkBST(tree: Tree): BSTCheck {
 const offender = findOffenders(tree)[0] ?? null;
  return { valid: offender === null, offender };
}