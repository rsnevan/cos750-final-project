/**
comparing and re-keying trees.
 sameTree checks answers such as "build this tree"; mapKeys gives
 retakes new keys while keeping the same shape.
 */
import { NotImplementedError } from './errors';
import type { Tree } from './types';

// True when both trees have the same shape and the same key in every position.
export function sameTree(a: Tree, b: Tree): boolean {
  throw new NotImplementedError('sameTree');
}

/**
  Apply 'f' to every key, keeping the shape. 'f' must be strictly increasing,
  such as adding a fixed offset, so the result is still a valid BST.
 */
export function mapKeys(tree: Tree, f: (key: number) => number): Tree {
  throw new NotImplementedError('mapKeys');
}