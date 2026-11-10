/**
delete (Lesson 5).
Find the node with search, then:
 - leaf: remove it;
 - one child: the child's whole subtree takes its place;
 - two children: copy in the in-order successor (the minimum of the right
 subtree), then delete the successor's old node from the right subtree.
 */
import { NotImplementedError } from './errors';
import type { DeleteResult, Tree } from './types';

// The in-order successor within the key's right subtree, or null if it has none.
export function successor(tree: Tree, key: number): number | null {
  throw new NotImplementedError('successor');
}

// Delete a key, returning a new tree and which case applied.
export function remove(tree: Tree, key: number): DeleteResult {
  throw new NotImplementedError('remove');
}