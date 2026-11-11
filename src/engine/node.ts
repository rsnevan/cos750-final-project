/**
  nodes and shapes.
  Making nodes, and converting between trees and the nested-array 'Shape'
  form. 
 */
import type { Shape, Tree, TreeNode } from './types';
import { assertWholeNumber } from './keys';


export function createNode(key: number, left: Tree = null, right: Tree = null): TreeNode { // children default to empty.
  assertWholeNumber(key);
  return Object.freeze({ key, left, right });
}

export function isLeaf(node: TreeNode): boolean { //true for no children
    return node.left === null && node.right === null;
}

// Build a tree exactly as written, without checking the BST rule. Used for the invalid trees in Lesson 1 (X, V, the 55 tree).
export function fromShape(shape: Shape | null): Tree {
   const seen = new Set<number>();
 
  function build(part: Shape | null | undefined): Tree {
    if (part === null || part === undefined) return null;
    const [key, left, right] = part;
    if (seen.has(key)) {
      throw new Error(`Shape has a duplicate key ${key}`);
    }
    seen.add(key);
    return createNode(key, build(left), build(right));
  }
 
  return build(shape);
}

// Write a tree as a canonical Shape (see types.ts), or null if empty. 
export function toShape(tree: Tree): Shape | null {
  if (tree === null) return null;
  const left = toShape(tree.left);
  const right = toShape(tree.right);
  if (right !== null) return [tree.key, left, right];
  if (left !== null) return [tree.key, left];
  return [tree.key];
}