/**
the BST rule (Lesson 1).
For every node, every key in its left subtree is smaller and every key in
its right subtree is larger. The rule covers whole subtrees, so a node must
be checked against every ancestor, not only its parent.
 */
import { NotImplementedError } from './errors';
import type { BSTCheck, Tree } from './types';

export function checkBST(tree: Tree): BSTCheck {
  throw new NotImplementedError('checkBST');
}