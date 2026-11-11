/**
  Shared pieces of the resolver: what it knows about the item being resolved,
  key shifting, errors that name the item, and small tree helpers.
  Internal to the content module.
 */
import { insert, preorder, remove, subtree } from '../engine';
import type { TraversalOrder, Tree } from '../engine';
import { CONFIG } from './config';
import { fillText } from './placeholders';
import type { PlaceholderValue } from './placeholders';
import type { ItemSpec, TreeRef } from './schema';
import { TREES, getTree } from './trees';

export type Values = Record<string, PlaceholderValue>;

 // Everything one retake of an item needs while it is being resolved. 
export interface Context {
  item: ItemSpec;
  retake: number;
  offset: number;
  // How errors name what is being resolved; defaults to `Item "<id>"`. 
  label?: string;
  // The question's tree, with this retake's keys. 
  tree: Tree;
  // Every key in the tree, for checking written keys. 
  keys: ReadonlySet<number>;
  // What the task is about, shifted, for the highlight presets.
  key?: number;
  from?: number;
  find?: readonly ('min' | 'max')[];
  order?: TraversalOrder;
  depthOf?: number;
  heightOf?: number;
}

// Throw an Error that names the item (or stage), so a mistake in the JSON is easy to find. 
export function fail(context: Pick<Context, 'item'> & { label?: string }, message: string): never {
  throw new Error(`${context.label ?? `Item "${context.item.id}"`}: ${message}`);
}

// Shift a written key for this retake, checking it is whole and stays inside the key range. 
export function shiftKey(context: Context, key: number, where: string): number {
  if (!Number.isInteger(key)) fail(context, `${where}: ${JSON.stringify(key)} is not a whole-number key`);
  const shifted = key + context.offset;
  const [lo, hi] = CONFIG.keyRange;
  if (shifted < lo || shifted > hi) {
    fail(context, `${where}: key ${key} becomes ${shifted} on retake ${context.retake}, outside ${lo} to ${hi}`);
  }
  return shifted;
}

// Shift a written key that must name a node in the tree. 
export function shiftNode(context: Context, key: number, where: string): number {
  const shifted = shiftKey(context, key, where);
  if (!context.keys.has(shifted)) fail(context, `${where}: key ${key} is not in the tree`);
  return shifted;
}

// Fill text for this retake, naming the item and the place if it fails. 
export function fill(context: Context, values: Values, template: string, where: string): string {
  try {
    return fillText(template, context.offset, values);
  } catch (error) {
    return fail(context, `${where}: ${(error as Error).message}`);
  }
}

// Build a tree reference for a retake: a named tree, after any keys it lists are inserted and then deleted. `owner` is what errors name.

export function treeFromRef(owner: Pick<Context, 'item' | 'label'>, ref: TreeRef, retake: number, offset: number): Tree {
  const name = typeof ref === 'string' ? ref : ref.from;
  if (!Object.hasOwn(TREES, name)) {
    fail(owner, `there is no tree "${name}" (the trees are ${Object.keys(TREES).join(', ')})`);
  }
  let tree = getTree(name, retake);
  if (typeof ref === 'string') return tree;

  // shiftKey only needs the offset; the keys set is not used.
  const context: Context = { ...owner, retake, offset, tree, keys: new Set() };
  for (const key of ref.insert ?? []) {
    const result = insert(tree, shiftKey(context, key, 'tree insert'));
    if (!result.added) fail(owner, `tree: ${key} is already in "${name}", so it can't be inserted`);
    tree = result.tree;
  }
  for (const key of ref.delete ?? []) {
    const result = remove(tree, shiftKey(context, key, 'tree delete'));
    if (result.case === null) fail(owner, `tree: ${key} is not in "${name}", so it can't be deleted`);
    tree = result.tree;
  }
  return tree;
}

//  tree helpers 

// The parent-child edges along a path of keys: [50, 70, 60] gives [[50, 70], [70, 60]]. 
export function pathEdges(path: readonly number[]): [number, number][] {
  return path.slice(1).map((key, i) => [path[i] as number, key]);
}

// The leftmost of the longest paths from the root down to a leaf. 
export function longestPath(tree: Tree): number[] {
  if (tree === null) return [];
  const left = longestPath(tree.left);
  const right = longestPath(tree.right);
  return [tree.key, ...(right.length > left.length ? right : left)];
}

// The path from the root to a key by the tree's shape, so it works on invalid trees too. 
export function pathTo(tree: Tree, key: number): number[] | null {
  if (tree === null) return null;
  if (tree.key === key) return [key];
  const below = pathTo(tree.left, key) ?? pathTo(tree.right, key);
  return below === null ? null : [tree.key, ...below];
}

// Every key outside the subtree rooted at `key`, in pre-order. 
export function outside(tree: Tree, key: number): number[] {
  const inside = new Set(preorder(subtree(tree, key)));
  return preorder(tree).filter((k) => !inside.has(k));
}

// "20", "20 and 40", "20, 40 and 60". 
export function listInWords(keys: readonly number[]): string {
  if (keys.length <= 1) return keys.join('');
  return `${keys.slice(0, -1).join(', ')} and ${keys.at(-1)}`;
}

// "1 edge", "2 edges". 
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

//  seeded shuffling 

// A small seeded random number generator (FNV-1a hash of the seed, then mulberry32). 
function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A shuffled order of the indexes 0 to n - 1, the same every time for this item, retake and part.
export function shuffledOrder(context: Context, partIndex: number, n: number): number[] {
  const random = seededRandom(`${context.item.id}#${context.retake}#${partIndex}`);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  return order;
}