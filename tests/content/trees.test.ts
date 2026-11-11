import { describe, expect, it } from 'vitest';
import { CONFIG, TREES, getTree, offsetFor, validateConfig, validateTrees } from '../../src/content';
import { checkBST, mapKeys, preorder, sameTree, toShape } from '../../src/engine';
import type { Shape } from '../../src/engine';
import {
  T2_SHAPE,
  T55_SHAPE,
  T_SHAPE,
  U_SHAPE,
  V_SHAPE,
  W_SHAPE,
  X_SHAPE,
} from '../engine/fixtures';

/** The lesson trees, drawn by hand from the lesson plan in the engine fixtures. */
const DRAWN: Record<string, Shape> = {
  T: T_SHAPE,
  T2: T2_SHAPE,
  U: U_SHAPE,
  X: X_SHAPE,
  T55: T55_SHAPE,
  V: V_SHAPE,
  W: W_SHAPE,
  // Lesson 1 explore, tree C: the sides swapped.
  SWAP: [50, [70], [30]],
};

const NAMES = Object.keys(DRAWN);
const RETAKES = CONFIG.retakeOffsets.map((_, retake) => retake);

describe('the tree library', () => {
  it('holds exactly the lesson trees', () => {
    expect(Object.keys(TREES).sort()).toEqual([...NAMES].sort());
  });

  it.each(NAMES)('builds %s exactly as the lesson plan draws it', (name) => {
    expect(toShape(getTree(name))).toEqual(DRAWN[name]);
  });

  it('builds T, T2 and U from inserts, so they are valid by construction', () => {
    for (const name of ['T', 'T2', 'U']) {
      expect(TREES[name]).toHaveProperty('insert');
      expect(checkBST(getTree(name)).valid).toBe(true);
    }
  });

  it('keeps X, T55, V and SWAP invalid, and W valid, as Lesson 1 and the final test need', () => {
    expect(checkBST(getTree('SWAP')).valid).toBe(false);
    expect(checkBST(getTree('X')).valid).toBe(false);
    expect(checkBST(getTree('T55')).valid).toBe(false);
    expect(checkBST(getTree('V')).valid).toBe(false);
    expect(checkBST(getTree('W')).valid).toBe(true);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TREES)).toBe(true);
  });
});

describe('getTree for retakes', () => {
  it('shifts T by 7 for the first retake', () => {
    expect(toShape(getTree('T', 1))).toEqual([57, [37, [27], [47]], [77, [67], [87]]]);
  });

  it.each(NAMES)('keeps the shape of %s and shifts every key by the offset', (name) => {
    const original = getTree(name);
    for (const retake of RETAKES) {
      const offset = offsetFor(retake);
      expect(sameTree(getTree(name, retake), mapKeys(original, (key) => key + offset))).toBe(true);
    }
  });

  it.each(NAMES)('keeps %s valid or invalid on every retake', (name) => {
    const valid = checkBST(getTree(name)).valid;
    for (const retake of RETAKES) {
      expect(checkBST(getTree(name, retake)).valid).toBe(valid);
    }
  });

  it('keeps every key of every tree in 1 to 99 on every retake', () => {
    const [lo, hi] = CONFIG.keyRange;
    for (const name of NAMES) {
      for (const retake of RETAKES) {
        for (const key of preorder(getTree(name, retake))) {
          expect(key).toBeGreaterThanOrEqual(lo);
          expect(key).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it('wraps round after the last retake', () => {
    expect(sameTree(getTree('U', RETAKES.length), getTree('U', 0))).toBe(true);
  });

  it('rejects an unknown tree, naming it', () => {
    expect(() => getTree('Q')).toThrow(/Q/);
  });

  it('rejects a bad retake number', () => {
    expect(() => getTree('T', -1)).toThrow(RangeError);
  });
});

describe('validateTrees', () => {
  it('accepts a valid library and returns a frozen copy', () => {
    const raw = { A: { insert: [50, 30, 80] }, B: { shape: [50, null, [30]] } };
    const library = validateTrees(raw);
    expect(library).toEqual(raw);
    expect(library).not.toBe(raw);
    expect(Object.isFrozen(library)).toBe(true);
  });

  it('rejects something that is not a library', () => {
    for (const bad of [null, [], 'T']) {
      expect(() => validateTrees(bad)).toThrow();
    }
  });

  it('rejects a tree name that could not be written in a question', () => {
    expect(() => validateTrees({ 'my tree': { insert: [5] } })).toThrow(/my tree/);
    expect(() => validateTrees({ '1T': { insert: [5] } })).toThrow(/1T/);
  });

  it('rejects a spec with neither, both, or extra fields, naming the tree', () => {
    expect(() => validateTrees({ A: {} })).toThrow(/A/);
    expect(() => validateTrees({ A: { insert: [5], shape: [5] } })).toThrow(/A/);
    expect(() => validateTrees({ A: { insert: [5], note: 'x' } })).toThrow(/A/);
    expect(() => validateTrees({ A: [5] })).toThrow(/A/);
  });

  it('rejects an insert list that is empty, repeats a key, or has a key that is not whole', () => {
    // build() would quietly skip a repeat, so a typo would draw a different tree.
    expect(() => validateTrees({ A: { insert: [] } })).toThrow(/A/);
    expect(() => validateTrees({ A: { insert: [5, 3, 5] } })).toThrow(/A/);
    expect(() => validateTrees({ A: { insert: [5, 3.5] } })).toThrow(/A/);
    expect(() => validateTrees({ A: { insert: [5, '3'] } })).toThrow(/A/);
  });

  it('rejects a shape that is malformed or repeats a key', () => {
    for (const bad of [[], 5, ['5'], [5, 3], [5, null, null, null], [5, [3], [3]], [2.5]]) {
      expect(() => validateTrees({ A: { shape: bad } })).toThrow(/A/);
    }
  });

  it('rejects a tree whose keys would leave 1 to 99 on some retake', () => {
    // 95 + 13 = 108 on retake 3; 4 - 7 = -3 on retake 2.
    expect(() => validateTrees({ A: { insert: [50, 95] } })).toThrow(/A/);
    expect(() => validateTrees({ A: { shape: [50, [4]] } })).toThrow(/A/);
  });

  it('checks the key range against the settings it is given', () => {
    const wide = validateConfig({ ...CONFIG, keyRange: [1, 200] });
    expect(() => validateTrees({ A: { insert: [50, 95] } }, wide)).not.toThrow();
  });

  it('accepts a shape that breaks the BST rule, as Lesson 1 needs', () => {
    expect(validateTrees({ A: { shape: [50, [60]] } })).toEqual({ A: { shape: [50, [60]] } });
  });
});