import { describe, expect, it } from 'vitest';
import { build, fromShape, inorder, postorder, preorder, toShape, traverse } from '../../src/engine';
import type { Shape, TraversalOrder } from '../../src/engine';
import { T2_SHAPE, T_SHAPE, U_SHAPE, X_SHAPE } from './fixtures';

// Expected sequences from the lesson plan's Lesson 4 activity ('Walk the tree') and final test.
describe('traversals of tree T (Lesson 4, items 1 to 3)', () => {
  const t = fromShape(T_SHAPE);

  it('pre-order is 50 30 20 40 70 60 80', () => {
    expect(preorder(t)).toStrictEqual([50, 30, 20, 40, 70, 60, 80]);
  });

  it('in-order is 20 30 40 50 60 70 80', () => {
    expect(inorder(t)).toStrictEqual([20, 30, 40, 50, 60, 70, 80]);
  });

  it('post-order is 20 40 30 60 80 70 50', () => {
    expect(postorder(t)).toStrictEqual([20, 40, 30, 60, 80, 70, 50]);
  });
});

describe('traversals from the rest of the lesson plan', () => {
  it('pre-order of the subtree rooted at 70 is 70 60 80 (Lesson 4, item 4)', () => {
    expect(preorder(fromShape([70, [60], [80]]))).toStrictEqual([70, 60, 80]);
  });

  it('post-order of T2 is 20 45 40 30 60 80 70 50 (Lesson 4, item 5)', () => {
    expect(postorder(fromShape(T2_SHAPE))).toStrictEqual([20, 45, 40, 30, 60, 80, 70, 50]);
  });

  it('in-order of U is 10 20 22 25 35 45 50 60 (final test, item 7)', () => {
    expect(inorder(fromShape(U_SHAPE))).toStrictEqual([10, 20, 22, 25, 35, 45, 50, 60]);
  });

  it('post-order of U is 10 22 25 20 45 60 50 35 (final test, item 8)', () => {
    expect(postorder(fromShape(U_SHAPE))).toStrictEqual([10, 22, 25, 20, 45, 60, 50, 35]);
  });

  it('pre-order of U is 35 20 10 25 22 50 45 60', () => {
    expect(preorder(fromShape(U_SHAPE))).toStrictEqual([35, 20, 10, 25, 22, 50, 45, 60]);
  });
});

describe('in-order and the BST rule (Lesson 4, item 6)', () => {
  const builtTrees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
  ];

  it.each(builtTrees)('in-order of %s is sorted, so build kept the BST rule', (_name, shape) => {
    const keys = inorder(fromShape(shape));
    expect(keys).toStrictEqual([...keys].sort((a, b) => a - b));
  });

  it('in-order of invalid tree X is not sorted: 30 50 40 70', () => {
    expect(inorder(fromShape(X_SHAPE))).toStrictEqual([30, 50, 40, 70]);
  });
});

describe('edge cases', () => {
  it.each(['pre', 'in', 'post'] as const)('%s-order of the empty tree is empty', (order) => {
    expect(traverse(null, order)).toStrictEqual([]);
  });

  it.each(['pre', 'in', 'post'] as const)('%s-order of a single node is just that key', (order) => {
    expect(traverse(fromShape([50]), order)).toStrictEqual([50]);
  });

  it('a one-sided chain visits top-down in pre-order and bottom-up in post-order', () => {
    const chain = build([10, 20, 30]);
    expect(preorder(chain)).toStrictEqual([10, 20, 30]);
    expect(postorder(chain)).toStrictEqual([30, 20, 10]);
  });

  it('never changes the tree it is given', () => {
    const t = fromShape(T_SHAPE);
    preorder(t);
    inorder(t);
    postorder(t);
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });
});

describe('traverse', () => {
  const t = fromShape(T_SHAPE);

  it('gives the same answer as the matching function for each order', () => {
    expect(traverse(t, 'pre')).toStrictEqual(preorder(t));
    expect(traverse(t, 'in')).toStrictEqual(inorder(t));
    expect(traverse(t, 'post')).toStrictEqual(postorder(t));
  });

  it('rejects an unknown order, which JavaScript callers could pass', () => {
    expect(() => traverse(t, 'level' as TraversalOrder)).toThrow(RangeError);
  });
});