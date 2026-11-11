/**
  search, the core algorithm (Lesson 2).
  Compare with the current node: equal means found, smaller goes left,
  larger goes right. Reaching an empty spot means not found.
 */
import { assertWholeNumber } from './keys';
import type { SearchResult, Side, Tree } from './types';

// Search for a key, recording every node visited and where the search stopped.
export function search(tree: Tree, key: number): SearchResult {
assertWholeNumber(key);
 
  const path: number[] = [];
  let node = tree;
  let endAt: number | null = null;
  let side: Side | null = null;
 
  while (node !== null) {
    path.push(node.key);
    if (key === node.key) {
      return { path, found: true, endAt: null, side: null };
    }
    endAt = node.key;
    side = key < node.key ? 'left' : 'right';
    node = side === 'left' ? node.left : node.right;
  }
    return { path, found: false, endAt, side };
}

// True when the key is in the tree.
export function contains(tree: Tree, key: number): boolean {
  return search(tree, key).found;
}