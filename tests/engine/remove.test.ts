import { describe, expect, it } from 'vitest';
import {
  checkBST,
  childCount,
  fromShape,
  inorder,
  min,
  remove,
  size,
  subtree,
  successor,
  toShape,
} from '../../src/engine';
import type { DeleteCase, Shape } from '../../src/engine';
import { T2_SHAPE, T_SHAPE, U_SHAPE } from './fixtures';

const t = fromShape(T_SHAPE);
const t2 = fromShape(T2_SHAPE);
const u = fromShape(U_SHAPE);

describe('successor is the next key in in-order', () => {
  it('the in-order successor of 50 in T is 60 (Lesson 5, item 5)', () => {
    expect(successor(t, 50)).toBe(60);
  });

  it('gives the next key in in-order for every key of T, and null for the largest', () => {
    const keys = inorder(t);
    keys.forEach((key, i) => {
      expect(successor(t, key)).toBe(keys[i + 1] ?? null);
    });
  });

  it('is the minimum of the right subtree when there is one (the Lesson 5 shortcut)', () => {
    for (const key of [30, 50, 70]) {
      expect(successor(t, key)).toBe(min(subtree(t, key)?.right ?? null));
    }
  });

  it('is an ancestor when there is no right subtree: after 40 in T comes 50', () => {
    expect(successor(t, 40)).toBe(50);
  });

  it('is null for a missing key or the empty tree', () => {
    expect(successor(t, 65)).toBeNull();
    expect(successor(null, 50)).toBeNull();
  });
});

// Answers from the lesson plan's Lesson 5 ("Remove it") and final test.
describe('case 1: deleting a leaf', () => {
  it('delete 60 from T: 70 keeps only its right child 80 (Lesson 5, item 1)', () => {
    const result = remove(t, 60);
    expect(result.case).toBe('leaf');
    expect(result.successor).toBeNull();
    expect(toShape(result.tree)).toStrictEqual([50, [30, [20], [40]], [70, null, [80]]]);
  });

  it('delete 20 from T: 30 keeps only 40 (Lesson 5 worked example)', () => {
    expect(toShape(remove(t, 20).tree)).toStrictEqual([50, [30, null, [40]], [70, [60], [80]]]);
  });

  it('deleting the only node leaves the empty tree', () => {
    expect(remove(fromShape([50]), 50)).toStrictEqual({ tree: null, case: 'leaf', successor: null });
  });
});

describe('case 2: deleting a node with one child', () => {
  it('delete 40 from T2: 45 takes its place as the right child of 30 (Lesson 5, item 2)', () => {
    const result = remove(t2, 40);
    expect(result.case).toBe('one');
    expect(toShape(result.tree)).toStrictEqual([50, [30, [20], [45]], [70, [60], [80]]]);
  });

  it('delete 25 from U: 22 becomes the right child of 20 (final test, item 9)', () => {
    const result = remove(u, 25);
    expect(result.case).toBe('one');
    expect(toShape(result.tree)).toStrictEqual([35, [20, [10], [22]], [50, [45], [60]]]);
  });

  it("the child's whole subtree moves up, not just the child", () => {
    const tree = fromShape([50, [30, [20, [10], [25]]], [70]]);
    expect(toShape(remove(tree, 30).tree)).toStrictEqual([50, [20, [10], [25]], [70]]);
  });

  it('deleting a root with one child makes that child the root', () => {
    expect(toShape(remove(fromShape([50, null, [70, [60]]]), 50).tree)).toStrictEqual([70, [60]]);
  });
});

describe('case 3: deleting a node with two children, using the successor', () => {
  it('delete 30 from T: the node becomes 40, with left child 20 and no right child (Lesson 5, item 3)', () => {
    const result = remove(t, 30);
    expect(result).toMatchObject({ case: 'two', successor: 40 });
    expect(toShape(result.tree)).toStrictEqual([50, [40, [20]], [70, [60], [80]]]);
  });

  it('delete 50 from T: the root becomes 60, and 70 keeps only 80 (Lesson 5, item 4)', () => {
    const result = remove(t, 50);
    expect(result).toMatchObject({ case: 'two', successor: 60 });
    expect(toShape(result.tree)).toStrictEqual([60, [30, [20], [40]], [70, null, [80]]]);
  });

  it('delete 70 from T: the node becomes 80 with left child 60 (Lesson 5 worked example)', () => {
    const result = remove(t, 70);
    expect(result).toMatchObject({ case: 'two', successor: 80 });
    expect(toShape(result.tree)).toStrictEqual([50, [30, [20], [40]], [80, [60]]]);
  });

  it('delete 20 from U: the node becomes 22 with left child 10 and right child 25 (final test, item 10)', () => {
    const result = remove(u, 20);
    expect(result).toMatchObject({ case: 'two', successor: 22 });
    expect(toShape(result.tree)).toStrictEqual([35, [22, [10], [25]], [50, [45], [60]]]);
  });

  it("removes the successor's old node, and its right child moves up into the gap", () => {
    // In T2 the successor of 30 is 40, which has a right child, 45.
    const result = remove(t2, 30);
    expect(result).toMatchObject({ case: 'two', successor: 40 });
    expect(toShape(result.tree)).toStrictEqual([50, [40, [20], [45]], [70, [60], [80]]]);
  });

  it('uses the minimum of the right subtree, not of the whole tree (Lesson 5 misconception)', () => {
    expect(remove(t, 50).successor).not.toBe(min(t));
  });
});

describe('the BST rule survives every delete (Lesson 5, item 6)', () => {
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
  ];

  it.each(trees)(
    'deleting any key from %s leaves a valid BST with that key gone and everything else in order',
    (_name, shape) => {
      const tree = fromShape(shape);
      for (const key of inorder(tree)) {
        const result = remove(tree, key);
        expect(checkBST(result.tree).valid).toBe(true);
        expect(inorder(result.tree)).toStrictEqual(inorder(tree).filter((k) => k !== key));
        expect(size(result.tree)).toBe(size(tree) - 1);
      }
    },
  );

  it.each(trees)('the case reported for each key of %s matches its number of children', (_name, shape) => {
    const tree = fromShape(shape);
    const expected: Record<number, DeleteCase> = { 0: 'leaf', 1: 'one', 2: 'two' };
    for (const key of inorder(tree)) {
      expect(remove(tree, key).case).toBe(expected[childCount(tree, key) ?? -1]);
    }
  });
});

describe('missing keys, guards and immutability', () => {
  it('deleting a missing key changes nothing and gives back the same tree', () => {
    const result = remove(t, 65);
    expect(result).toStrictEqual({ tree: t, case: null, successor: null });
    expect(result.tree).toBe(t);
  });

  it('deleting from the empty tree gives the empty tree', () => {
    expect(remove(null, 50)).toStrictEqual({ tree: null, case: null, successor: null });
  });

  it('never changes the tree it is given', () => {
    for (const key of inorder(t)) remove(t, key);
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });

  it('reuses the subtree the delete did not touch', () => {
    expect(remove(t, 20).tree?.right).toBe(t?.right);
  });

  it('rejects a key that is not a whole number', () => {
    expect(() => remove(t, 2.5)).toThrow(RangeError);
    expect(() => successor(t, 2.5)).toThrow(RangeError);
  });
});