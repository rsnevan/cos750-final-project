/**
comparing and re-keying trees.
 sameTree checks answers such as "build this tree"; mapKeys gives
 retakes new keys while keeping the same shape.
 */
import { createNode } from './node';
import { preorder } from './traversal';
import type { Tree } from './types';

// True when both trees have the same shape and the same key in every position.
export function sameTree(a: Tree, b: Tree): boolean {
  if (a === b) return true; // the same object, or both empty
  if (a === null || b === null) return false;
  return a.key === b.key && sameTree(a.left, b.left) && sameTree(a.right, b.right);
}

/**
  Apply 'f' to every key, keeping the shape. 'f' must be strictly increasing,
  such as adding a fixed offset, so the result is still a valid BST.
 */
export function mapKeys(tree: Tree, f: (key: number) => number): Tree {
   const keys = preorder(tree).sort((a, b) => a - b);
  const newKeyFor = new Map<number, number>();
  let previous: number | null = null;
 
  for (const key of keys) {
    const mapped = f(key);
    if (previous !== null && !(mapped > previous)) {
      throw new RangeError(
        `mapKeys needs a strictly increasing function, but it gave ${mapped} after ${previous}`,
      );
    }
    newKeyFor.set(key, mapped);
    previous = mapped;
  }
 
  function rebuild(node: Tree): Tree {
    if (node === null) return null;
    // createNode also rejects mapped keys that aren't whole numbers.
    return createNode(newKeyFor.get(node.key) as number, rebuild(node.left), rebuild(node.right));
  }
 
  return rebuild(tree);
}