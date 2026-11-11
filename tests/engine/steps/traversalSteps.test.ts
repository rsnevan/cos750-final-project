import { describe, expect, it } from 'vitest';
import {
  fromShape,
  LINES,
  PSEUDOCODE,
  size,
  subtree,
  toShape,
  traversalSteps,
  traverse,
  walkSteps,
} from '../../../src/engine';
import type { Shape, TraversalOrder } from '../../../src/engine';
import { T2_SHAPE, T_SHAPE, U_SHAPE, X_SHAPE } from '../fixtures';
import { expectValidSteps } from './stepRules';

const t = fromShape(T_SHAPE);
const orders: TraversalOrder[] = ['pre', 'in', 'post'];

describe('traversalSteps: the Lesson 4 worked example on T', () => {
  it('pre-order starts by visiting 50, with the dots on and the marker on 50\'s left', () => {
    expect(traversalSteps(t, 'pre')[0]).toStrictEqual({
      tree: t,
      highlight: {
        visited: [50],
        current: 50,
        marker: { key: 50, position: 'pre' },
        dots: 'pre',
        output: [50],
      },
      text: 'Visit 50: pre-order writes a node before its children.',
      line: LINES.traverse.pre,
    });
  });

  it('pre-order writes 50 30 20 40 70 60 80', () => {
    expect(traversalSteps(t, 'pre').at(-1)?.highlight.output).toStrictEqual([50, 30, 20, 40, 70, 60, 80]);
  });

  it('in-order writes 20 30 40 50 60 70 80, and the last step points out that it is sorted', () => {
    const steps = traversalSteps(t, 'in');
    expect(steps.at(-1)?.highlight.output).toStrictEqual([20, 30, 40, 50, 60, 70, 80]);
    expect(steps.at(-1)?.text).toBe(
      'Visit 80: in-order writes a node between its left and right subtrees. Every node has been visited exactly once. The list is sorted.',
    );
  });

  it('post-order writes 20 40 30 60 80 70 50, finishing at the root', () => {
    const steps = traversalSteps(t, 'post');
    expect(steps.at(-1)?.highlight.output).toStrictEqual([20, 40, 30, 60, 80, 70, 50]);
    expect(steps.at(-1)?.text).toBe(
      'Visit 50: post-order writes a node after both of its children. Every node has been visited exactly once.',
    );
  });

  it('Try it: pre-order of the subtree rooted at 30 is 30 20 40', () => {
    expect(traversalSteps(subtree(t, 30), 'pre').map((s) => s.highlight.current)).toStrictEqual([30, 20, 40]);
  });
});

describe('the "sorted" remark is only made when it is true', () => {
  it('in-order of invalid tree X is not sorted, and the last step says what that means', () => {
    const steps = traversalSteps(fromShape(X_SHAPE), 'in');
    expect(steps.at(-1)?.highlight.output).toStrictEqual([30, 50, 40, 70]);
    expect(steps.at(-1)?.text).toBe(
      'Visit 70: in-order writes a node between its left and right subtrees. Every node has been visited exactly once. The list is not sorted, so this tree breaks the BST rule.',
    );
  });

  it('pre-order and post-order never comment on sorting', () => {
    for (const order of ['pre', 'post'] as const) {
      expect(traversalSteps(t, order).at(-1)?.text).not.toMatch(/sorted/);
    }
  });
});

describe('traversalSteps agrees with traverse', () => {
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
    ['X', X_SHAPE],
  ];

  it.each(trees)('in %s, for every order', (_name, shape) => {
    const tree = fromShape(shape);
    for (const order of orders) {
      const steps = traversalSteps(tree, order);
      const expected = traverse(tree, order);

      expectValidSteps(steps, PSEUDOCODE.traverse);
      expect(steps).toHaveLength(size(tree));

      steps.forEach((step, i) => {
        expect(step.tree).toBe(tree);
        expect(step.highlight.output).toStrictEqual(expected.slice(0, i + 1));
        expect(step.highlight.visited).toStrictEqual(expected.slice(0, i + 1));
        expect(step.highlight.current).toBe(expected[i]);
        expect(step.highlight.marker).toStrictEqual({ key: expected[i], position: order });
        expect(step.highlight.dots).toBe(order);
        expect(step.line).toBe(LINES.traverse[order]);
      });
    }
  });

  it('the empty tree gives one step: there is nothing to visit', () => {
    expect(traversalSteps(null, 'in')).toStrictEqual([
      {
        tree: null,
        highlight: { dots: 'in', output: [] },
        text: 'The tree is empty, so there is nothing to visit.',
        line: LINES.traverse.empty,
      },
    ]);
  });
});

describe('walkSteps: the marker walk from Lesson 4 Explore', () => {
  it('passes every node of T three times: 21 positions', () => {
    expect(walkSteps(t)).toHaveLength(21);
  });

  it('starts on the left of the root and ends on its right', () => {
    const steps = walkSteps(t);
    expect(steps[0]).toStrictEqual({
      tree: t,
      highlight: { current: 50, marker: { key: 50, position: 'pre' } },
      text: 'The marker passes 50 on its left side, on the way down.',
    });
    expect(steps[1]?.text).toBe('The marker passes 30 on its left side, on the way down.');
    expect(steps.at(-1)?.text).toBe('The marker passes 50 on its right side, on the way back up.');
  });

  it('passes a leaf on all three sides one after another', () => {
    // 20 is a leaf: left side, underside, right side in a row.
    expect(walkSteps(t).slice(2, 5).map((s) => s.text)).toStrictEqual([
      'The marker passes 20 on its left side, on the way down.',
      'The marker passes 20 on its underside, between its two subtrees.',
      'The marker passes 20 on its right side, on the way back up.',
    ]);
  });

  // The memory aid, proven: reading the walk at one side of every node gives that traversal.
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
  ];

  it.each(trees)('in %s, the left passes give pre-order, the undersides in-order, the right passes post-order', (_name, shape) => {
    const tree = fromShape(shape);
    const steps = walkSteps(tree);
    expectValidSteps(steps, []);
    for (const order of orders) {
      const passes = steps.filter((s) => s.highlight.marker?.position === order).map((s) => s.highlight.marker?.key);
      expect(passes).toStrictEqual(traverse(tree, order));
    }
  });

  it('the empty tree gives one step', () => {
    expect(walkSteps(null)).toStrictEqual([
      { tree: null, highlight: {}, text: 'The tree is empty, so there is nothing to walk around.' },
    ]);
  });
});

describe('guards', () => {
  it('rejects an unknown order, which JavaScript code could pass', () => {
    expect(() => traversalSteps(t, 'level' as TraversalOrder)).toThrow(RangeError);
  });

  it('never changes the tree', () => {
    for (const order of orders) traversalSteps(t, order);
    walkSteps(t);
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });
});