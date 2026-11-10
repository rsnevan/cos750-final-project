/**
  nodes and shapes.
  Making nodes, and converting between trees and the nested-array 'Shape'
  form. 
 */
import { NotImplementedError } from './errors';
import type { Shape, Tree, TreeNode } from './types';


export function createNode(key: number, left: Tree = null, right: Tree = null): TreeNode { // children default to empty.
  throw new NotImplementedError('createNode');
}

export function isLeaf(node: TreeNode): boolean { //true for no children
  throw new NotImplementedError('isLeaf');
}

// Build a tree exactly as written, without checking the BST rule. Used for the invalid trees in Lesson 1 (X, V, the 55 tree).
export function fromShape(shape: Shape | null): Tree {
  throw new NotImplementedError('fromShape');
}

// Write a tree as a canonical Shape (see types.ts), or null if empty. 
export function toShape(tree: Tree): Shape | null {
  throw new NotImplementedError('toShape');
}