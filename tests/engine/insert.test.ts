import { describe, expect, it } from 'vitest';
import { build, fromShape, insert, toShape } from '../../src/engine';
import type { Tree, TreeNode } from '../../src/engine';
import { T2_KEYS, T2_SHAPE, T_KEYS, T_SHAPE, U_KEYS, U_SHAPE } from './fixtures';

function allNodes(tree: Tree): TreeNode[] {
  if (tree === null) return [];
  return [tree, ...allNodes(tree.left), ...allNodes(tree.right)];
}

describe('insert', () => {
  it('makes the key the root of an empty tree', () => {
    const result = insert(null, 50);
    expect(result.added).toBe(true);
    expect(toShape(result.tree)).toStrictEqual([50]);
  });

  // Answers from the lesson plan's Lesson 3 activity ("Grow the tree") and final test.
  it('puts 10 into T as the left child of 20 (Lesson 3, item 1)', () => {
    const { tree, added } = insert(fromShape(T_SHAPE), 10);
    expect(added).toBe(true);
    expect(toShape(tree)).toStrictEqual([50, [30, [20, [10]], [40]], [70, [60], [80]]]);
  });

  it('puts 55 into T as the left child of 60 (Lesson 3, item 2)', () => {
    const { tree } = insert(fromShape(T_SHAPE), 55);
    expect(toShape(tree)).toStrictEqual([50, [30, [20], [40]], [70, [60, [55]], [80]]]);
  });

  it('puts 65 into T as the right child of 60 (Lesson 3, Try it)', () => {
    const { tree } = insert(fromShape(T_SHAPE), 65);
    expect(toShape(tree)).toStrictEqual([50, [30, [20], [40]], [70, [60, null, [65]], [80]]]);
  });

  it('turns T into T2 by inserting 45 as the right child of 40', () => {
    const { tree } = insert(fromShape(T_SHAPE), 45);
    expect(toShape(tree)).toStrictEqual(T2_SHAPE);
  });

  it('puts 55 into U as the left child of 60 (final test, item 5)', () => {
    const { tree } = insert(fromShape(U_SHAPE), 55);
    expect(toShape(tree)).toStrictEqual([35, [20, [10], [25, [22]]], [50, [45], [60, [55]]]]);
  });

  it('changes nothing when the key is already there (Lesson 3, item 3)', () => {
    const t = fromShape(T_SHAPE);
    const result = insert(t, 50);
    expect(result.added).toBe(false);
    expect(result.tree).toBe(t); // the very same tree comes back, not a copy
  });

  it('reports a duplicate deep in the tree too', () => {
    const t = fromShape(T_SHAPE);
    const result = insert(t, 60);
    expect(result.added).toBe(false);
    expect(result.tree).toBe(t);
  });

  it('never changes the tree it is given', () => {
    const t = fromShape(T_SHAPE);
    insert(t, 45);
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });

  it('returns a new root, and reuses the subtree the insert did not touch', () => {
    const t = fromShape(T_SHAPE);
    const { tree } = insert(t, 10); // 10 goes down the left side only
    expect(tree).not.toBe(t);
    expect(tree?.right).toBe(t?.right); // 70's subtree is shared, not copied
  });

  it('only creates frozen nodes', () => {
    const { tree } = insert(fromShape(T_SHAPE), 45);
    expect(allNodes(tree).every((node) => Object.isFrozen(node))).toBe(true);
  });

  it('rejects a key that is not a whole number', () => {
    expect(() => insert(fromShape(T_SHAPE), 2.5)).toThrow(RangeError);
  });
});

describe('build', () => {
  it('gives the empty tree for no keys', () => {
    expect(build([])).toBeNull();
  });

  it('builds tree T from 50, 30, 70, 20, 40, 60, 80', () => {
    expect(toShape(build(T_KEYS))).toStrictEqual(T_SHAPE);
  });

  it('builds tree T2 from T\'s keys followed by 45', () => {
    expect(toShape(build(T2_KEYS))).toStrictEqual(T2_SHAPE);
  });

  it('builds tree U from 35, 20, 50, 10, 25, 45, 60, 22', () => {
    expect(toShape(build(U_KEYS))).toStrictEqual(U_SHAPE);
  });

  it('builds 40, 20, 60, 10 as in Lesson 3, item 4', () => {
    // Root 40; left child 20 with left child 10; right child 60.
    expect(toShape(build([40, 20, 60, 10]))).toStrictEqual([40, [20, [10]], [60]]);
  });

  it('skips a repeated key', () => {
    expect(toShape(build([50, 30, 50]))).toStrictEqual([50, [30]]);
  });

  it('builds a one-sided chain from keys in sorted order, because order decides shape', () => {
    expect(toShape(build([10, 20, 30]))).toStrictEqual([10, null, [20, null, [30]]]);
  });

  it('rejects a key that is not a whole number', () => {
    expect(() => build([50, 2.5])).toThrow(RangeError);
  });
});