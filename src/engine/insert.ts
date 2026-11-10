/**
  insert and build (Lesson 3).
  A new key always becomes a leaf at the empty spot where a search for it
  stops. No existing node moves. Inserting an existing key changes nothing.
 */
import { NotImplementedError } from './errors';
import type { InsertResult, Tree } from './types';

// Insert one key, returning a new tree.
export function insert(tree: Tree, key: number): InsertResult {
  throw new NotImplementedError('insert');
}

// Build a tree by inserting keys in the given order, starting from empty.
export function build(keys: readonly number[]): Tree {
  throw new NotImplementedError('build');
}