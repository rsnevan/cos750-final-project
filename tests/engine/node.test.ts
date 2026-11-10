import { describe, expect, it } from 'vitest';
import { createNode, fromShape, isLeaf, toShape } from '../../src/engine';
import type { Shape, Tree, TreeNode } from '../../src/engine';
import { T2_SHAPE, T55_SHAPE, T_SHAPE, U_SHAPE, V_SHAPE, W_SHAPE, X_SHAPE } from './fixtures';

// Every node in a tree, so a test can check something about all of them.
function allNodes(tree: Tree): TreeNode[] {
  if (tree === null) return [];
  return [tree, ...allNodes(tree.left), ...allNodes(tree.right)];
}

describe('createNode', () => {
  it('makes a node with no children by default', () => {
    expect(createNode(50)).toEqual({ key: 50, left: null, right: null });
  });

  it('keeps the children it is given', () => {
    const left = createNode(30);
    const right = createNode(70);
    const node = createNode(50, left, right);
    expect(node.left).toBe(left);
    expect(node.right).toBe(right);
  });

  it('returns a frozen node, so JavaScript code cannot change it either', () => {
    const node = createNode(50);
    expect(Object.isFrozen(node)).toBe(true);
    expect(() => {
      (node as { key: number }).key = 99;
    }).toThrow(TypeError);
  });

  it.each([2.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects %s, because keys must be whole numbers',
    (key) => {
      expect(() => createNode(key)).toThrow(RangeError);
    },
  );
});

describe('isLeaf', () => {
  it('is true for a node with no children', () => {
    expect(isLeaf(createNode(20))).toBe(true);
  });

  it('is false for a node with only a left child', () => {
    expect(isLeaf(createNode(25, createNode(22)))).toBe(false);
  });

  it('is false for a node with only a right child', () => {
    expect(isLeaf(createNode(40, null, createNode(45)))).toBe(false);
  });

  it('is false for a node with two children', () => {
    expect(isLeaf(createNode(30, createNode(20), createNode(40)))).toBe(false);
  });
});

describe('fromShape', () => {
  it('gives the empty tree for null', () => {
    expect(fromShape(null)).toBeNull();
  });

  it('builds a single leaf', () => {
    expect(fromShape([50])).toEqual({ key: 50, left: null, right: null });
  });

  it('builds a node with only a left child', () => {
    expect(fromShape([25, [22]])).toEqual({
      key: 25,
      left: { key: 22, left: null, right: null },
      right: null,
    });
  });

  it('builds a node with only a right child', () => {
    expect(fromShape([40, null, [45]])).toEqual({
      key: 40,
      left: null,
      right: { key: 45, left: null, right: null },
    });
  });

  it('builds tree T with every node in the right place', () => {
    const t = fromShape(T_SHAPE);
    expect(t?.key).toBe(50);
    expect(t?.left?.key).toBe(30);
    expect(t?.left?.left?.key).toBe(20);
    expect(t?.left?.right?.key).toBe(40);
    expect(t?.right?.key).toBe(70);
    expect(t?.right?.left?.key).toBe(60);
    expect(t?.right?.right?.key).toBe(80);
    expect(allNodes(t)).toHaveLength(7);
  });

  it('builds trees exactly as written, without checking the BST rule', () => {
    // Tree X is invalid: 40 sits in 50's right subtree. fromShape must still build it.
    const x = fromShape(X_SHAPE);
    expect(x?.right?.key).toBe(70);
    expect(x?.right?.left?.key).toBe(40);
  });

  it('freezes every node it builds', () => {
    expect(allNodes(fromShape(U_SHAPE)).every((node) => Object.isFrozen(node))).toBe(true);
  });

  it('rejects a shape with a duplicate key', () => {
    expect(() => fromShape([50, [30], [70, [30]]])).toThrow(/duplicate key 30/);
  });

  it('rejects a shape with a key that is not a whole number', () => {
    expect(() => fromShape([50, [2.5]])).toThrow(RangeError);
  });
});

describe('toShape', () => {
  it('gives null for the empty tree', () => {
    expect(toShape(null)).toBeNull();
  });

  // toStrictEqual, not toEqual: [25, [22]] and [25, [22], undefined] must count as different,
  // so the canonical form in types.ts is enforced exactly.
  it('writes a leaf as [key]', () => {
    expect(toShape(createNode(50))).toStrictEqual([50]);
  });

  it('writes a left-only node as [key, left]', () => {
    expect(toShape(createNode(25, createNode(22)))).toStrictEqual([25, [22]]);
  });

  it('writes a right-only node as [key, null, right]', () => {
    expect(toShape(createNode(40, null, createNode(45)))).toStrictEqual([40, null, [45]]);
  });

  it('writes a node with two children as [key, left, right]', () => {
    expect(toShape(createNode(30, createNode(20), createNode(40)))).toStrictEqual([30, [20], [40]]);
  });

  const referenceShapes: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
    ['X', X_SHAPE],
    ['the 55 tree', T55_SHAPE],
    ['V', V_SHAPE],
    ['W', W_SHAPE],
  ];

  it.each(referenceShapes)('gives back the same shape for %s after fromShape', (_name, shape) => {
    expect(toShape(fromShape(shape))).toStrictEqual(shape);
  });
});