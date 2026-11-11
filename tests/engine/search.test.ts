import { describe, expect, it } from 'vitest';
import { contains, fromShape, insert, inorder, search, toShape } from '../../src/engine';
import { T_SHAPE, U_SHAPE, X_SHAPE } from './fixtures';

const t = fromShape(T_SHAPE);

// Answers from the lesson plan's Lesson 2 ("Find the path") and final test.
describe('search finds keys that are in the tree', () => {
  it('finds 60 in T by visiting 50, 70, 60 (Lesson 2 worked example)', () => {
    expect(search(t, 60)).toStrictEqual({ path: [50, 70, 60], found: true, endAt: null, side: null });
  });

  it('finds 20 in T by visiting 50, 30, 20 (Lesson 2, item 1)', () => {
    expect(search(t, 20)).toStrictEqual({ path: [50, 30, 20], found: true, endAt: null, side: null });
  });

  it('finds 80 in T by visiting 50, 70, 80 (Lesson 2 Try it)', () => {
    expect(search(t, 80).path).toStrictEqual([50, 70, 80]);
  });

  it('finds the root after visiting only the root', () => {
    expect(search(t, 50)).toStrictEqual({ path: [50], found: true, endAt: null, side: null });
  });

  it('finds every key of T, and never visits more than 3 nodes (Lesson 2, item 4)', () => {
    for (const key of inorder(t)) {
      const result = search(t, key);
      expect(result.found).toBe(true);
      expect(result.path.at(-1)).toBe(key);
      expect(result.path.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('search stops at an empty spot when the key is missing', () => {
  it('searching T for 65 visits 50, 70, 60 and stops at the empty right side of 60 (Lesson 2, item 2)', () => {
    expect(search(t, 65)).toStrictEqual({ path: [50, 70, 60], found: false, endAt: 60, side: 'right' });
  });

  it('searching T for 45 ends at the empty right side of 40 (Lesson 2 worked example, item 3)', () => {
    expect(search(t, 45)).toStrictEqual({ path: [50, 30, 40], found: false, endAt: 40, side: 'right' });
  });

  it('searching U for 47 visits 35, 50, 45 and is not found (final test, item 4)', () => {
    expect(search(fromShape(U_SHAPE), 47)).toStrictEqual({
      path: [35, 50, 45],
      found: false,
      endAt: 45,
      side: 'right',
    });
  });

  it('checks the empty side of a leaf instead of stopping at the leaf (Lesson 2 misconception)', () => {
    // 20 is a leaf, but the search still compares 10 with it and looks at its empty left side.
    expect(search(t, 10)).toStrictEqual({ path: [50, 30, 20], found: false, endAt: 20, side: 'left' });
  });

  it('visits nothing in the empty tree', () => {
    expect(search(null, 50)).toStrictEqual({ path: [], found: false, endAt: null, side: null });
  });
});

describe('search and insert agree', () => {
  it('a missing key is inserted exactly where its search stopped, for every missing key from 1 to 99', () => {
    for (let key = 1; key <= 99; key++) {
      const before = search(t, key);
      if (before.found) continue;
      const after = search(insert(t, key).tree, key);
      expect(after.path).toStrictEqual([...before.path, key]);
      expect(after.found).toBe(true);
    }
  });
});

describe('search relies on the BST rule', () => {
  it('misses 40 in invalid tree X even though 40 is there, because 40 is on the wrong side of 50', () => {
    // This is why Lesson 1 teaches the rule: search only works if every key is on the correct side.
    expect(search(fromShape(X_SHAPE), 40)).toStrictEqual({
      path: [50, 30],
      found: false,
      endAt: 30,
      side: 'right',
    });
  });
});

describe('search guards and immutability', () => {
  it('never changes the tree it is given', () => {
    search(t, 65);
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });

  it('rejects a key that is not a whole number', () => {
    expect(() => search(t, 2.5)).toThrow(RangeError);
  });

  it('rejects the string "60", which JavaScript code might pass from an input box', () => {
    expect(() => search(t, '60' as unknown as number)).toThrow(RangeError);
  });
});

describe('contains', () => {
  it('is true for every key of T', () => {
    for (const key of [50, 30, 70, 20, 40, 60, 80]) expect(contains(t, key)).toBe(true);
  });

  it('is false for a missing key and for the empty tree', () => {
    expect(contains(t, 65)).toBe(false);
    expect(contains(null, 50)).toBe(false);
  });

  it('rejects a key that is not a whole number', () => {
    expect(() => contains(t, 2.5)).toThrow(RangeError);
  });
});