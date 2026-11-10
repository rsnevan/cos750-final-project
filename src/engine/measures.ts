/**
 tree vocabulary and measures (Lesson 1, and helpers for Lesson 5).
 Height and depth count edges: a single node has height 0, the empty tree -1.
 */
import { NotImplementedError } from './errors';
import type { Tree } from './types';

// Number of nodes.
export function size(tree: Tree): number {
  throw new NotImplementedError('size');
}

// Edges on the longest path from the root down to a leaf. -1 for the empty tree.
export function height(tree: Tree): number {
  throw new NotImplementedError('height');
}

// Edges from the root to the key, or null if the key isn't in the tree.
export function depth(tree: Tree, key: number): number | null {
  throw new NotImplementedError('depth');
}

// Keys of all leaves, left to right.
export function leaves(tree: Tree): number[] {
  throw new NotImplementedError('leaves');
}

// The parent's key,  null for the root or a missing key.
export function parentOf(tree: Tree, key: number): number | null {
  throw new NotImplementedError('parentOf');
}

// 0, 1 or 2 children, or null if the key isn't in the tree.
export function childCount(tree: Tree, key: number): 0 | 1 | 2 | null {
  throw new NotImplementedError('childCount');
}

//The subtree rooted at the key, or null if the key isn't in the tree.
export function subtree(tree: Tree, key: number): Tree {
  throw new NotImplementedError('subtree');
}