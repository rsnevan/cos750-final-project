/**
  the tree as text, for screen readers and "Show the tree as text".
  One plain sentence per node, root first, for example
  "50 is the root, with left child 30 and right child 70."
 */
import { NotImplementedError } from './errors';
import type { Tree } from './types';

// One sentence per node in pre-order. An empty tree gives ["The tree is empty."].
export function describe(tree: Tree): string[] {
  throw new NotImplementedError('describe');
}