/**
  depth-first traversals (Lesson 4).
  The three orders differ only in when a node is visited:
  pre-order before its subtrees, in-order between them, post-order after them.
 */
import type { Tree } from './types';

export type TraversalOrder = 'pre' | 'in' | 'post';


// recursive walk function for all orders. Always left then right, order just decides if the key is recorded before, between, or after the subtrees. 
function walk(tree: Tree, order: TraversalOrder, visited: number[]): void {
  if (tree === null) return;
  if (order === 'pre') visited.push(tree.key);
  walk(tree.left, order, visited);
  if (order === 'in') visited.push(tree.key);
  walk(tree.right, order, visited);
  if (order === 'post') visited.push(tree.key);
}

// Node, then left subtree, then right subtree.
export function preorder(tree: Tree): number[] {
  return traverse(tree, 'pre');
}

//Left subtree, then node, then right subtree. Sorted for a valid BST.
export function inorder(tree: Tree): number[] {
  return traverse(tree, 'in');
}

// Left subtree, then right subtree, then node.
export function postorder(tree: Tree): number[] {
  return traverse(tree, 'post');
}

// Run the traversal
export function traverse(tree: Tree, order: TraversalOrder): number[] {
if (order !== 'pre' && order !== 'in' && order !== 'post') {
    throw new RangeError(`Unknown traversal order "${String(order)}". Use 'pre', 'in' or 'post'.`);
  }
  const visited: number[] = [];
  walk(tree, order, visited);
  return visited;
}