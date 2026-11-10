/**
  search, the core algorithm (Lesson 2).
  Compare with the current node: equal means found, smaller goes left,
  larger goes right. Reaching an empty spot means not found.
 */
import { NotImplementedError } from './errors';
import type { SearchResult, Tree } from './types';

// Search for a key, recording every node visited and where the search stopped.
export function search(tree: Tree, key: number): SearchResult {
  throw new NotImplementedError('search');
}

// True when the key is in the tree.
export function contains(tree: Tree, key: number): boolean {
  throw new NotImplementedError('contains');
}