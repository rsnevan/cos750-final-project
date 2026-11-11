import { describe, expect, it } from 'vitest';
import {
  build,
  childCount,
  depth,
  fromShape,
  height,
  inorder,
  leaves,
  min,
  parentOf,
  preorder,
  search,
  size,
  subtree,
  toShape,
} from '../../src/engine';
import type { Shape } from '../../src/engine';
import { T2_SHAPE, T_SHAPE, U_SHAPE, X_SHAPE } from './fixtures';

const t = fromShape(T_SHAPE);
const t2 = fromShape(T2_SHAPE);
const u = fromShape(U_SHAPE);

describe('size', () => {
  it('counts every node: T has 7, T2 and U have 8', () => {
    expect(size(t)).toBe(7);
    expect(size(t2)).toBe(8);
    expect(size(u)).toBe(8);
  });

  it('is 0 for the empty tree', () => {
    expect(size(null)).toBe(0);
  });
});

// Height counts edges (lesson plan decision 3): a single node has height 0, the empty tree -1.
describe('height', () => {
  it('T has height 2 (Lesson 1 worked example)', () => {
    expect(height(t)).toBe(2);
  });

  it('the subtree rooted at 30 has height 1 (Lesson 1, item 2)', () => {
    expect(height(subtree(t, 30))).toBe(1);
  });

  it('U has height 3 (final test, item 1)', () => {
    expect(height(u)).toBe(3);
  });

  it('T2 has height 3, because 45 adds a level under 40', () => {
    expect(height(t2)).toBe(3);
  });

  it('a single node has height 0 and the empty tree -1', () => {
    expect(height(fromShape([50]))).toBe(0);
    expect(height(null)).toBe(-1);
  });

  it('a one-sided chain of 3 keys has height 2', () => {
    expect(height(build([10, 20, 30]))).toBe(2);
  });
});

describe('depth', () => {
  it('the depth of 40 in T is 2 (Lesson 1, item 2)', () => {
    expect(depth(t, 40)).toBe(2);
  });

  it('the root has depth 0', () => {
    expect(depth(t, 50)).toBe(0);
  });

  it('22 has depth 3 in U', () => {
    expect(depth(u, 22)).toBe(3);
  });

  it('is null for a missing key or the empty tree', () => {
    expect(depth(t, 65)).toBeNull();
    expect(depth(null, 50)).toBeNull();
  });
});

describe('height and depth agree with each other and with search', () => {
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
    ['a one-sided chain', [10, null, [20, null, [30, null, [40]]]]],
  ];

  it.each(trees)('the height of %s is the largest depth of any of its keys', (_name, shape) => {
    const tree = fromShape(shape);
    const depths = inorder(tree).map((key) => depth(tree, key) ?? -1);
    expect(height(tree)).toBe(Math.max(...depths));
  });

  it.each(trees)(
    'a search in %s visits at most height + 1 nodes, and some search visits exactly that many (Lesson 2)',
    (_name, shape) => {
      const tree = fromShape(shape);
      const longest = Math.max(...Array.from({ length: 99 }, (_, i) => search(tree, i + 1).path.length));
      expect(longest).toBe(height(tree) + 1);
    },
  );
});

describe('leaves', () => {
  it('T has leaves 20, 40, 60, 80 (Lesson 1, item 1)', () => {
    expect(leaves(t)).toStrictEqual([20, 40, 60, 80]);
  });

  it('U has leaves 10, 22, 45, 60 (final test, item 1)', () => {
    expect(leaves(u)).toStrictEqual([10, 22, 45, 60]);
  });

  it('a single node is a leaf, and the empty tree has none', () => {
    expect(leaves(fromShape([50]))).toStrictEqual([50]);
    expect(leaves(null)).toStrictEqual([]);
  });
});

describe('parentOf', () => {
  it('finds the parent of a key', () => {
    expect(parentOf(t, 40)).toBe(30);
    expect(parentOf(t, 80)).toBe(70);
    expect(parentOf(t2, 45)).toBe(40);
  });

  it('is null for the root and for a missing key', () => {
    expect(parentOf(t, 50)).toBeNull();
    expect(parentOf(t, 65)).toBeNull();
  });
});

describe('childCount', () => {
  // These are the three delete cases in Lesson 5.
  it('60 in T has no children, 40 in T2 has one, and 30 in T has two', () => {
    expect(childCount(t, 60)).toBe(0);
    expect(childCount(t2, 40)).toBe(1);
    expect(childCount(t, 30)).toBe(2);
  });

  it('is null for a missing key', () => {
    expect(childCount(t, 65)).toBeNull();
  });
});

describe('subtree', () => {
  it('the subtree rooted at 70 in T is 70 with children 60 and 80', () => {
    expect(toShape(subtree(t, 70))).toStrictEqual([70, [60], [80]]);
  });

  it('gives Lesson 3 item 6 (smallest key under 70 is 60) and Lesson 4 item 4 (pre-order 70 60 80)', () => {
    expect(min(subtree(t, 70))).toBe(60);
    expect(preorder(subtree(t, 70))).toStrictEqual([70, 60, 80]);
  });

  it('returns the same nodes as the tree, not a copy', () => {
    expect(subtree(t, 30)).toBe(t?.left);
  });

  it('is a single node for a leaf, and null for a missing key', () => {
    expect(toShape(subtree(t, 20))).toStrictEqual([20]);
    expect(subtree(t, 65)).toBeNull();
  });
});

describe('measures work on any binary tree, including ones that break the BST rule', () => {
  // Lesson 1 shows invalid trees, and the visualiser labels them. Search would miss 40 in X
  // (it's on the wrong side of 50), so these functions must look at every node instead.
  const x = fromShape(X_SHAPE);

  it('finds 40 in invalid tree X even though a search would not', () => {
    expect(search(x, 40).found).toBe(false);
    expect(depth(x, 40)).toBe(2);
    expect(parentOf(x, 40)).toBe(70);
    expect(childCount(x, 40)).toBe(0);
    expect(toShape(subtree(x, 70))).toStrictEqual([70, [40]]);
  });
});

describe('guards and immutability', () => {
  it.each([
    ['depth', () => depth(t, 2.5)],
    ['parentOf', () => parentOf(t, 2.5)],
    ['childCount', () => childCount(t, 2.5)],
    ['subtree', () => subtree(t, 2.5)],
  ])('%s rejects a key that is not a whole number', (_name, call) => {
    expect(call).toThrow(RangeError);
  });

  it('never changes the tree it is given', () => {
    size(t);
    height(t);
    depth(t, 40);
    leaves(t);
    parentOf(t, 40);
    childCount(t, 30);
    subtree(t, 70);
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });
});