/**
  insert and build (Lesson 3).
  A new key always becomes a leaf at the empty spot where a search for it
  stops. No existing node moves. Inserting an existing key changes nothing.
 */
import { createNode } from './node';
import type { InsertResult, Tree } from './types';

// Insert one key, returning a new tree.
export function insert(tree: Tree, key: number): InsertResult {
 if (tree === null) {
    return { tree: createNode(key), added: true };
  }
 
  if (key === tree.key) {
    return { tree, added: false };
  }
 
  if (key < tree.key) {
    const below = insert(tree.left, key);
    if (!below.added) return { tree, added: false };
    return { tree: createNode(tree.key, below.tree, tree.right), added: true };
  }
 
  const below = insert(tree.right, key);
  if (!below.added) return { tree, added: false };
  return { tree: createNode(tree.key, tree.left, below.tree), added: true };
}

// Build a tree by inserting keys in the given order, starting from empty.
export function build(keys: readonly number[]): Tree {
  return keys.reduce<Tree>((tree, key) => insert(tree, key).tree, null);
}