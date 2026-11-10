/**
 tree vocabulary and measures (Lesson 1, and helpers for Lesson 5).
 Height and depth count edges: a single node has height 0, the empty tree -1.
 */
import { assertWholeNumber } from './keys';
import type { Tree, TreeNode } from './types';

interface Located {
  node: TreeNode;
  parent: TreeNode | null;
  depth: number;
}

//find the node holding key with its parent and depth
function locate(tree: Tree, key: number, parent: TreeNode | null = null, depth = 0): Located | null {
  if (tree === null) return null;
  if (tree.key === key) return { node: tree, parent, depth };
  return (
    locate(tree.left, key, tree, depth + 1) ?? locate(tree.right, key, tree, depth + 1)
  );
}


//check key then locate it
function find(tree: Tree, key: number): Located | null {
  assertWholeNumber(key);
  return locate(tree, key);
}
// Number of nodes.
export function size(tree: Tree): number {
  if (tree === null) return 0;
  return 1 + size(tree.left) + size(tree.right);}

// Edges on the longest path from the root down to a leaf. -1 for the empty tree.
export function height(tree: Tree): number { 
    if (tree === null) return -1;
    return 1 + Math.max(height(tree.left), height(tree.right));
}

// Edges from the root to the key, or null if the key isn't in the tree.
export function depth(tree: Tree, key: number): number | null {
  return find(tree, key)?.depth ?? null;
}

// Keys of all leaves, left to right.
export function leaves(tree: Tree): number[] {
  if (tree === null) return [];
  if (tree.left === null && tree.right === null) return [tree.key];
  return [...leaves(tree.left), ...leaves(tree.right)];
}

// The parent's key,  null for the root or a missing key.
export function parentOf(tree: Tree, key: number): number | null {
  return find(tree, key)?.parent?.key ?? null;
}

// 0, 1 or 2 children, or null if the key isn't in the tree.
export function childCount(tree: Tree, key: number): 0 | 1 | 2 | null {
  const found = find(tree, key);
  if (found === null) return null;
  const { left, right } = found.node;
  if (left !== null && right !== null) return 2;
  if (left !== null || right !== null) return 1;
  return 0;
}

//The subtree rooted at the key, or null if the key isn't in the tree.
export function subtree(tree: Tree, key: number): Tree {
  return find(tree, key)?.node ?? null;
}