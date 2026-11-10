/**
 minimum and maximum (Lesson 3).
 The minimum is found by going left until there is no left child, the
 maximum by going right. No comparisons are needed, and the minimum is
 not always a leaf (it can have a right child).
 */
import { NotImplementedError } from './errors';
import type { Tree } from './types';

// Smallest key, or`null for the empty tree.
export function min(tree: Tree): number | null {
  throw new NotImplementedError('min');
}

//Largest key, or null for the empty tree.
export function max(tree: Tree): number | null {
  throw new NotImplementedError('max');
}

// Keys visited on the way down to the minimum, root first.
export function minPath(tree: Tree): number[] {
  throw new NotImplementedError('minPath');
}

// Keys visited on the way down to the maximum, root first.
export function maxPath(tree: Tree): number[] {
  throw new NotImplementedError('maxPath');
}