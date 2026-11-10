/**
  depth-first traversals (Lesson 4).
  The three orders differ only in when a node is visited:
  pre-order before its subtrees, in-order between them, post-order after them.
 */
import { NotImplementedError } from './errors';
import type { Tree } from './types';

export type TraversalOrder = 'pre' | 'in' | 'post';

// Node, then left subtree, then right subtree.
export function preorder(tree: Tree): number[] {
  throw new NotImplementedError('preorder');
}

//Left subtree, then node, then right subtree. Sorted for a valid BST.
export function inorder(tree: Tree): number[] {
  throw new NotImplementedError('inorder');
}

// Left subtree, then right subtree, then node.
export function postorder(tree: Tree): number[] {
  throw new NotImplementedError('postorder');
}

// Run the traversal
export function traverse(tree: Tree, order: TraversalOrder): number[] {
  throw new NotImplementedError('traverse');
}