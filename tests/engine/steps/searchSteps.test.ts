import { describe, expect, it } from 'vitest';
import { fromShape, LINES, PSEUDOCODE, search, searchSteps, toShape } from '../../../src/engine';
import type { Shape } from '../../../src/engine';
import { T_SHAPE, U_SHAPE } from '../fixtures';
import { expectValidSteps } from './stepRules';

const t = fromShape(T_SHAPE);

describe('searchSteps: the Lesson 2 worked examples, step by step', () => {
  it('search T for 60: right at 50, left at 70, found at 60', () => {
    expect(searchSteps(t, 60)).toStrictEqual([
      {
        tree: t,
        highlight: { visited: [50], current: 50, edges: [] },
        text: 'Start at the root, 50. 60 is larger than 50, so go right.',
        line: LINES.search.goRight,
      },
      {
        tree: t,
        highlight: { visited: [50, 70], current: 70, edges: [[50, 70]] },
        text: 'Now at 70. 60 is smaller than 70, so go left.',
        line: LINES.search.goLeft,
      },
      {
        tree: t,
        highlight: { visited: [50, 70, 60], found: 60, edges: [[50, 70], [70, 60]] },
        text: '60 equals 60: found it after 3 comparisons.',
        line: LINES.search.equal,
      },
    ]);
  });

  it('search T for 45: ends at the empty right side of 40', () => {
    const steps = searchSteps(t, 45);
    expect(steps.map((s) => s.text)).toStrictEqual([
      'Start at the root, 50. 45 is smaller than 50, so go left.',
      'Now at 30. 45 is larger than 30, so go right.',
      'Now at 40. 45 is larger than 40, so go right.',
      'The right side of 40 is empty, so 45 is not in the tree. 3 nodes visited.',
    ]);
    expect(steps.at(-1)).toStrictEqual({
      tree: t,
      highlight: { visited: [50, 30, 40], edges: [[50, 30], [30, 40]], slot: { parent: 40, side: 'right' } },
      text: 'The right side of 40 is empty, so 45 is not in the tree. 3 nodes visited.',
      line: LINES.search.empty,
    });
  });

  it('finding the root takes one step and one comparison', () => {
    expect(searchSteps(t, 50)).toStrictEqual([
      {
        tree: t,
        highlight: { visited: [50], found: 50, edges: [] },
        text: '50 equals 50: found it after 1 comparison.',
        line: LINES.search.equal,
      },
    ]);
  });

  it('searching the empty tree is one step at the empty root', () => {
    expect(searchSteps(null, 50)).toStrictEqual([
      {
        tree: null,
        highlight: { visited: [], edges: [], slot: { parent: null, side: null } },
        text: 'The tree is empty, so 50 is not in the tree.',
        line: LINES.search.empty,
      },
    ]);
  });
});

describe('searchSteps agrees with search, for every key from 1 to 99', () => {
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['U', U_SHAPE],
  ];

  it.each(trees)('in %s', (_name, shape) => {
    const tree = fromShape(shape);
    for (let key = 1; key <= 99; key++) {
      const result = search(tree, key);
      const steps = searchSteps(tree, key);

      expectValidSteps(steps, PSEUDOCODE.search);

      // One step per comparison, plus one for the empty spot when not found.
      expect(steps).toHaveLength(result.path.length + (result.found ? 0 : 1));

      // The visited list grows by one node per comparison and ends on search's path.
      steps.slice(0, result.path.length).forEach((step, i) => {
        expect(step.highlight.visited).toStrictEqual(result.path.slice(0, i + 1));
      });
      expect(steps.at(-1)?.highlight.visited).toStrictEqual(result.path);

      // Search never changes the tree, so every step shows the tree it was given.
      for (const step of steps) expect(step.tree).toBe(tree);

      // The text says what the highlighted pseudocode line does.
      for (const step of steps) {
        const says = {
          [LINES.search.goLeft]: 'so go left.',
          [LINES.search.goRight]: 'so go right.',
          [LINES.search.equal]: 'found it',
          [LINES.search.empty]: 'is not in the tree',
        }[step.line ?? -1];
        expect(step.text).toContain(says);
      }
    }
  });
});

describe('guards', () => {
  it('rejects a key that is not a whole number', () => {
    expect(() => searchSteps(t, 2.5)).toThrow(RangeError);
  });

  it('never changes the tree', () => {
    searchSteps(t, 65);
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });
});