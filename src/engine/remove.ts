/**
delete (Lesson 5).
Find the node with search, then:
 - leaf: remove it;
 - one child: the child's whole subtree takes its place;
 - two children: copy in the in-order successor (the minimum of the right
 subtree), then delete the successor's old node from the right subtree.
 */
import { min } from './extremes';
import { assertWholeNumber } from './keys';
import { createNode } from './node';
import type { DeleteResult, Tree } from './types';

// The in-order successor within the key's right subtree, or null if it has none.
export function successor(tree: Tree, key: number): number | null {
  assertWholeNumber(key);
 
  let node = tree;
  let nearestLeftTurn: number | null = null; // last ancestor where the search went left
 
  while (node !== null && node.key !== key) {
    if (key < node.key) {
      nearestLeftTurn = node.key;
      node = node.left;
    } else {
      node = node.right;
    }
  }
 
  if (node === null) return null; // key not in the tree
  if (node.right !== null) return min(node.right);
  return nearestLeftTurn;
}

// Delete a key, returning a new tree and which case applied.
export function remove(tree: Tree, key: number): DeleteResult {
   assertWholeNumber(key);
   return removeFrom(tree, key);
}

const NOT_FOUND = { case: null, successor: null } as const;

function removeFrom(tree: Tree, key: number): DeleteResult {
  if (tree === null) return { tree: null, ...NOT_FOUND };
 
  if (key < tree.key) {
    const below = removeFrom(tree.left, key);
    if (below.case === null) return { tree, ...NOT_FOUND };
    return { ...below, tree: createNode(tree.key, below.tree, tree.right) };
  }
 
  if (key > tree.key) {
    const below = removeFrom(tree.right, key);
    if (below.case === null) return { tree, ...NOT_FOUND };
    return { ...below, tree: createNode(tree.key, tree.left, below.tree) };
  }
 
  // Found the node to delete.
  if (tree.left === null && tree.right === null) {
    return { tree: null, case: 'leaf', successor: null };
  }
  if (tree.left === null) {
    return { tree: tree.right, case: 'one', successor: null };
  }
  if (tree.right === null) {
    return { tree: tree.left, case: 'one', successor: null };
  }
 
  // Two children: the successor is the minimum of the right subtree. It has
  // no left child, so removing its old node is always case 1 or case 2.
  const next = min(tree.right) as number; // the right subtree isn't empty here
  const rightWithoutNext = removeFrom(tree.right, next).tree;
  return { tree: createNode(next, tree.left, rightWithoutNext), case: 'two', successor: next };
}