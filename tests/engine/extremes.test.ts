import { describe, expect, it } from 'vitest';
import { fromShape, inorder, isLeaf, max, maxPath, min, minPath, toShape } from '../../src/engine';
import type { Shape } from '../../src/engine';
import { T2_SHAPE, T_SHAPE, U_SHAPE } from './fixtures';

const t = fromShape(T_SHAPE);

// Answers from the lesson plan's Lesson 3 ("Grow the tree") and final test.
describe('minimum and maximum of the lesson trees', () => {
  it('T has minimum 20 and maximum 80 (Lesson 3, item 5)', () => {
    expect(min(t)).toBe(20);
    expect(max(t)).toBe(80);
  });

  it('the minimum of T is found along 50, 30, 20 and the maximum along 50, 70, 80 (Lesson 3 worked example)', () => {
    expect(minPath(t)).toStrictEqual([50, 30, 20]);
    expect(maxPath(t)).toStrictEqual([50, 70, 80]);
  });

  it('the smallest key in the subtree rooted at 70 is 60 (Lesson 3, item 6)', () => {
    const rootedAt70 = fromShape([70, [60], [80]]);
    expect(min(rootedAt70)).toBe(60);
    expect(minPath(rootedAt70)).toStrictEqual([70, 60]);
  });

  it('U has minimum 10 and maximum 60 (final test, item 6)', () => {
    const u = fromShape(U_SHAPE);
    expect(min(u)).toBe(10);
    expect(max(u)).toBe(60);
    expect(minPath(u)).toStrictEqual([35, 20, 10]);
    expect(maxPath(u)).toStrictEqual([35, 50, 60]);
  });
});

describe('minimum and maximum agree with in-order', () => {
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
  ];

  it.each(trees)('for %s, the minimum is the first key in-order and the maximum the last', (_name, shape) => {
    const tree = fromShape(shape);
    const sorted = inorder(tree);
    expect(min(tree)).toBe(sorted[0]);
    expect(max(tree)).toBe(sorted.at(-1));
  });

  it.each(trees)('for %s, each path ends at the key it reports', (_name, shape) => {
    const tree = fromShape(shape);
    expect(minPath(tree).at(-1)).toBe(min(tree));
    expect(maxPath(tree).at(-1)).toBe(max(tree));
  });
});

describe('Lesson 3 misconceptions', () => {
  it('the minimum is not always a leaf: it can have a right child', () => {
    const tree = fromShape([50, [30, null, [40]], [70]]);
    const minimumNode = tree?.left ?? fail();
    expect(min(tree)).toBe(30);
    expect(minimumNode.key).toBe(30);
    expect(isLeaf(minimumNode)).toBe(false);
  });

  it('the maximum is not always a leaf: it can have a left child', () => {
    const tree = fromShape([50, [30], [70, [60]]]);
    const maximumNode = tree?.right ?? fail();
    expect(max(tree)).toBe(70);
    expect(maximumNode.key).toBe(70);
    expect(isLeaf(maximumNode)).toBe(false);
  });

  it('needs no comparisons, so on a tree that breaks the BST rule it follows the shape, not the keys', () => {
    // 10 sits on 50's right side, which breaks the rule. Going left only ever reaches 30.
    // This is why the shortcut depends on the BST rule from Lesson 1.
    const broken = fromShape([50, [30], [70, [10]]]);
    expect(min(broken)).toBe(30);
  });
});

describe('edge cases', () => {
  it('a single node is both the minimum and the maximum', () => {
    const single = fromShape([50]);
    expect(min(single)).toBe(50);
    expect(max(single)).toBe(50);
    expect(minPath(single)).toStrictEqual([50]);
    expect(maxPath(single)).toStrictEqual([50]);
  });

  it('the empty tree has no minimum or maximum', () => {
    expect(min(null)).toBeNull();
    expect(max(null)).toBeNull();
    expect(minPath(null)).toStrictEqual([]);
    expect(maxPath(null)).toStrictEqual([]);
  });

  it('a one-sided chain to the right has the root as its minimum', () => {
    const chain = fromShape([10, null, [20, null, [30]]]);
    expect(min(chain)).toBe(10);
    expect(maxPath(chain)).toStrictEqual([10, 20, 30]);
  });

  it('never changes the tree it is given', () => {
    min(t);
    max(t);
    minPath(t);
    maxPath(t);
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });
});

// Fails the test with a clear message if a node the test expects is missing.
function fail(): never {
  throw new Error('Expected node is missing from the test tree');
}