/**
 minimum and maximum (Lesson 3).
 The minimum is found by going left until there is no left child, the
 maximum by going right. No comparisons are needed, and the minimum is
 not always a leaf (it can have a right child).
 */
import type {Side, Tree } from './types';

function PathToEnd(tree: Tree, side: Side): number[] {
    const path: number[] = [];
    let node = tree;
    while (node !== null) {
        path.push(node.key);
        node = side === 'left' ? node.left : node.right;
    }
    return path;
}
// Smallest key, or null for the empty tree.
export function min(tree: Tree): number | null {
  return minPath(tree).at(-1) ?? null;
}

//Largest key, or null for the empty tree.
export function max(tree: Tree): number | null {
  return maxPath(tree).at(-1) ?? null;
}

// Keys visited on the way down to the minimum, root first.
export function minPath(tree: Tree): number[] {
  return PathToEnd(tree, 'left');
}

// Keys visited on the way down to the maximum, root first.
export function maxPath(tree: Tree): number[] {
  return PathToEnd(tree, 'right');
}