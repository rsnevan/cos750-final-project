import { describe, expect, it } from 'vitest';
import { extremeSteps, fromShape, max, maxPath, min, minPath, toShape } from '../../../src/engine';
import type { Shape } from '../../../src/engine';
import { T2_SHAPE, T_SHAPE, U_SHAPE } from '../fixtures';
import { expectValidSteps, expectVisitedIsPath } from './stepRules';

const t = fromShape(T_SHAPE);

describe('extremeSteps: the Lesson 3 worked example', () => {
  it('the minimum of T: left at 50, left at 30, then 20 has no left child', () => {
    expect(extremeSteps(t, 'min')).toStrictEqual([
      {
        tree: t,
        highlight: { visited: [50], current: 50, edges: [] },
        text: 'Start at the root, 50. It has a left child, so keep going left.',
      },
      {
        tree: t,
        highlight: { visited: [50, 30], current: 30, edges: [[50, 30]] },
        text: 'At 30. It has a left child, so keep going left.',
      },
      {
        tree: t,
        highlight: { visited: [50, 30, 20], found: 20, edges: [[50, 30], [30, 20]] },
        text: '20 has no left child, so 20 is the minimum. No comparisons were needed.',
      },
    ]);
  });

  it('the maximum of T: right at 50, right at 70, then 80 has no right child', () => {
    expect(extremeSteps(t, 'max').map((s) => s.text)).toStrictEqual([
      'Start at the root, 50. It has a right child, so keep going right.',
      'At 70. It has a right child, so keep going right.',
      '80 has no right child, so 80 is the maximum. No comparisons were needed.',
    ]);
  });

  it('stops at a minimum that has a right child, which is not a leaf (Lesson 3 misconception)', () => {
    const tree = fromShape([50, [30, null, [40]], [70]]);
    expect(extremeSteps(tree, 'min').at(-1)?.text).toBe(
      '30 has no left child, so 30 is the minimum. No comparisons were needed.',
    );
  });

  it('a single node is its own minimum, in one step', () => {
    const single = fromShape([50]);
    expect(extremeSteps(single, 'min')).toStrictEqual([
      {
        tree: single,
        highlight: { visited: [50], found: 50, edges: [] },
        text: '50 has no left child, so 50 is the minimum. No comparisons were needed.',
      },
    ]);
  });

  it('the empty tree has no minimum or maximum', () => {
    expect(extremeSteps(null, 'min')).toStrictEqual([
      { tree: null, highlight: {}, text: 'The tree is empty, so it has no minimum.' },
    ]);
    expect(extremeSteps(null, 'max')[0]?.text).toBe('The tree is empty, so it has no maximum.');
  });
});

describe('extremeSteps agrees with min and max', () => {
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
    ['a one-sided chain', [10, null, [20, null, [30]]]],
  ];

  it.each(trees)('in %s', (_name, shape) => {
    const tree = fromShape(shape);
    for (const which of ['min', 'max'] as const) {
      const steps = extremeSteps(tree, which);
      const path = which === 'min' ? minPath(tree) : maxPath(tree);
      expectValidSteps(steps, []);
      expectVisitedIsPath(steps);
      expect(steps).toHaveLength(path.length);
      expect(steps.at(-1)?.highlight.found).toBe(which === 'min' ? min(tree) : max(tree));
      expect(steps.at(-1)?.highlight.visited).toStrictEqual(path);
      for (const step of steps) expect(step.tree).toBe(tree);
    }
  });
});

describe('guards', () => {
  it('rejects anything other than min or max, which JavaScript code could pass', () => {
    expect(() => extremeSteps(t, 'middle' as 'min')).toThrow(RangeError);
  });

  it('never changes the tree', () => {
    extremeSteps(t, 'min');
    extremeSteps(t, 'max');
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });
});