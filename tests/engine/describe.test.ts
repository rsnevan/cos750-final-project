import { describe, expect, it } from 'vitest';
// The engine's `describe` has the same name as Vitest's, so it is imported under another name.
import { build, describe as describeTree, fromShape, preorder, toShape } from '../../src/engine';
import type { Shape } from '../../src/engine';
import { T2_SHAPE, T55_SHAPE, T_SHAPE, U_SHAPE, V_SHAPE, W_SHAPE, X_SHAPE } from './fixtures';

/**
  Rebuild a tree's shape from its sentences alone. If this gives back the
  original tree, the text carries every detail the picture does, so a
  screen-reader user can answer the same questions as everyone else.
 */
function shapeFromSentences(sentences: string[]): Shape | null {
  const children = new Map<number, { left?: number; right?: number }>();
  for (const sentence of sentences) {
    const key = Number(/^\d+/.exec(sentence)?.[0]);
    const left = /left child (\d+)/.exec(sentence)?.[1];
    const right = /right child (\d+)/.exec(sentence)?.[1];
    children.set(key, {
      ...(left === undefined ? {} : { left: Number(left) }),
      ...(right === undefined ? {} : { right: Number(right) }),
    });
  }
  const rootKey = Number(/^\d+/.exec(sentences[0] ?? '')?.[0]);
  function shapeOf(key: number | undefined): Shape | null {
    if (key === undefined) return null;
    const { left, right } = children.get(key) ?? {};
    if (right !== undefined) return [key, shapeOf(left), shapeOf(right)];
    if (left !== undefined) return [key, shapeOf(left)];
    return [key];
  }
  return Number.isNaN(rootKey) ? null : shapeOf(rootKey);
}

describe('the tree as text, in the wireframe\'s wording', () => {
  it('describes T one node at a time, root first', () => {
    expect(describeTree(fromShape(T_SHAPE))).toStrictEqual([
      '50 is the root. It has left child 30 and right child 70.',
      '30 has left child 20 and right child 40.',
      '20 is a leaf.',
      '40 is a leaf.',
      '70 has left child 60 and right child 80.',
      '60 is a leaf.',
      '80 is a leaf.',
    ]);
  });

  it('names the side when a node has only one child', () => {
    expect(describeTree(fromShape(T2_SHAPE))).toContain('40 has right child 45.');
    expect(describeTree(fromShape(U_SHAPE))).toContain('25 has left child 22.');
  });

  it('describes a root with one child', () => {
    expect(describeTree(fromShape([50, null, [70]]))).toStrictEqual([
      '50 is the root. It has right child 70.',
      '70 is a leaf.',
    ]);
  });

  it('describes a single node and the empty tree', () => {
    expect(describeTree(fromShape([50]))).toStrictEqual(['50 is the root. It has no children.']);
    expect(describeTree(null)).toStrictEqual(['The tree is empty.']);
  });

  it('describes an invalid tree exactly as drawn, so the Lesson 1 activity works by screen reader', () => {
    expect(describeTree(fromShape(X_SHAPE))).toContain('70 has left child 40.');
  });
});

describe('the text is complete', () => {
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
    ['X', X_SHAPE],
    ['the 55 tree', T55_SHAPE],
    ['V', V_SHAPE],
    ['W', W_SHAPE],
    ['a one-sided chain', [10, null, [20, null, [30]]]],
  ];

  it.each(trees)('%s has one sentence per node, in pre-order', (_name, shape) => {
    const tree = fromShape(shape);
    const leadingKeys = describeTree(tree).map((sentence) => Number(/^\d+/.exec(sentence)?.[0]));
    expect(leadingKeys).toStrictEqual(preorder(tree));
  });

  it.each(trees)('%s can be rebuilt from its sentences alone', (_name, shape) => {
    expect(shapeFromSentences(describeTree(fromShape(shape)))).toStrictEqual(shape);
  });

  it('works for a larger tree too', () => {
    const tree = build([50, 25, 75, 12, 37, 62, 87, 6, 18, 31, 43, 56, 68, 81, 93]);
    expect(shapeFromSentences(describeTree(tree))).toStrictEqual(toShape(tree));
  });
});

describe('immutability', () => {
  it('never changes the tree it is given', () => {
    const t = fromShape(T_SHAPE);
    describeTree(t);
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });
});