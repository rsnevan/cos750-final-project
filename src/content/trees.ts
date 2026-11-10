/**
  The named lesson trees, loaded from `data/trees.json` and checked on load.
 
  A tree is either built by inserting keys in order ('insert'), which is how
  the valid lesson trees are made, or drawn exactly as written ('shape'),
  which is the only way to make the invalid trees in Lesson 1.
 */
import raw from './data/trees.json';
import { build, fromShape, mapKeys, preorder } from '../engine';
import type { Shape, Tree } from '../engine';
import { CONFIG, offsetFor } from './config';
import type { ContentConfig, TreeLibrary, TreeSpec } from './schema';

// A name that can be written as `"tree": "T2"` in a question: a letter, then letters, digits or _.
const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Check that 'value' is a well-formed Shape: '[key]', '[key, left]' or '[key, left, right]'. 
function checkShape(value: unknown, where: string): void {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    throw new Error(`${where}: each node must be written [key], [key, left] or [key, left, right]`);
  }
  if (!Number.isInteger(value[0])) {
    throw new Error(`${where}: ${JSON.stringify(value[0])} is not a whole-number key`);
  }
  for (const child of value.slice(1)) {
    if (child !== null) checkShape(child, where);
  }
}

// Build a spec's tree with its original keys.
function buildSpec(spec: TreeSpec): Tree {
  return 'insert' in spec ? build(spec.insert) : fromShape(spec.shape);
}

// Check one entry and return a frozen copy of it.
function checkSpec(name: string, spec: unknown, config: ContentConfig): TreeSpec {
  const where = `trees.json: tree "${name}"`;

  if (!NAME.test(name)) {
    throw new Error(`${where}: a name must be a letter followed by letters, digits or _`);
  }
  if (!isRecord(spec)) {
    throw new Error(`${where} must be { "insert": [...] } or { "shape": [...] }`);
  }
  const fields = Object.keys(spec);
  if (fields.length !== 1 || (fields[0] !== 'insert' && fields[0] !== 'shape')) {
    throw new Error(`${where} must have exactly one of "insert" or "shape", but has ${fields.join(', ') || 'neither'}`);
  }

  let copy: TreeSpec;
  if ('insert' in spec) {
    const keys = spec.insert;
    if (!Array.isArray(keys) || keys.length === 0 || !keys.every(Number.isInteger)) {
      throw new Error(`${where}: "insert" must be a list of one or more whole-number keys`);
    }
    // build() skips a repeated key, so a typo would quietly draw a different tree.
    if (new Set(keys).size !== keys.length) {
      throw new Error(`${where}: "insert" repeats a key`);
    }
    copy = { insert: Object.freeze([...keys]) as number[] };
  } else {
    checkShape(spec.shape, where);
    copy = { shape: spec.shape as Shape };
  }

  let keys: number[];
  try {
    keys = preorder(buildSpec(copy));
  } catch (error) {
    throw new Error(`${where}: ${(error as Error).message}`);
  }

  // Every retake must keep every key inside the key range.
  const [lo, hi] = config.keyRange;
  const smallest = Math.min(...keys);
  const largest = Math.max(...keys);
  config.retakeOffsets.forEach((offset, retake) => {
    if (smallest + offset < lo || largest + offset > hi) {
      throw new Error(
        `${where}: on retake ${retake} (offset ${offset}) its keys run from ` +
          `${smallest + offset} to ${largest + offset}, outside ${lo} to ${hi}`,
      );
    }
  });

  return Object.freeze(copy);
}

// Check a tree library, throwing an Error naming the first problem found.
export function validateTrees(raw: unknown, config: ContentConfig = CONFIG): TreeLibrary {
  if (!isRecord(raw)) {
    throw new Error('trees.json must hold one object of named trees');
  }
  const library: TreeLibrary = {};
  for (const [name, spec] of Object.entries(raw)) {
    library[name] = checkSpec(name, spec, config);
  }
  return Object.freeze(library);
}

// The checked tree library.
export const TREES: TreeLibrary = validateTrees(raw);

// A named tree for a retake: its keys shifted by that retake's offset.
export function getTree(name: string, retake = 0): Tree {
  const spec = Object.hasOwn(TREES, name) ? TREES[name] : undefined;
  if (spec === undefined) {
    throw new Error(`There is no tree "${name}" (the trees are ${Object.keys(TREES).join(', ')})`);
  }
  const offset = offsetFor(retake);
  const tree = buildSpec(spec);
  return offset === 0 ? tree : mapKeys(tree, (key) => key + offset);
}