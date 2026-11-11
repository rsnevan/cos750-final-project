import { describe, expect, it } from 'vitest';
import { fromShape, insert, insertSteps, LINES, PSEUDOCODE, sameTree, search, toShape } from '../../../src/engine';
import type { Shape } from '../../../src/engine';
import { T_SHAPE, U_SHAPE } from '../fixtures';
import { expectValidSteps, expectVisitedIsPath } from './stepRules';

const t = fromShape(T_SHAPE);

describe('insertSteps: the Lesson 3 examples, step by step', () => {
  it('insert 65 into T: three comparisons, the empty spot, then the new leaf', () => {
    const steps = insertSteps(t, 65);
    const grown = insert(t, 65).tree;

    expect(steps.slice(0, 4)).toStrictEqual([
      {
        tree: t,
        highlight: { visited: [50], current: 50, edges: [] },
        text: 'Start at the root, 50. 65 is larger than 50, so go right.',
        line: LINES.insert.goRight,
      },
      {
        tree: t,
        highlight: { visited: [50, 70], current: 70, edges: [[50, 70]] },
        text: 'Now at 70. 65 is smaller than 70, so go left.',
        line: LINES.insert.goLeft,
      },
      {
        tree: t,
        highlight: { visited: [50, 70, 60], current: 60, edges: [[50, 70], [70, 60]] },
        text: 'Now at 60. 65 is larger than 60, so go right.',
        line: LINES.insert.goRight,
      },
      {
        tree: t,
        highlight: { visited: [50, 70, 60], edges: [[50, 70], [70, 60]], slot: { parent: 60, side: 'right' } },
        text: 'The right side of 60 is empty. This is where 65 goes.',
        line: LINES.insert.empty,
      },
    ]);

    const last = steps[4];
    expect(steps).toHaveLength(5);
    expect(sameTree(last?.tree ?? null, grown)).toBe(true);
    expect(last?.highlight).toStrictEqual({ found: 65, edges: [[50, 70], [70, 60], [60, 65]] });
    expect(last?.text).toBe('65 becomes the right child of 60. It is a new leaf, and no other node moved.');
    expect(last?.line).toBe(LINES.insert.empty);
  });

  it('insert 50 into T: already there, so nothing changes (Lesson 3, item 3)', () => {
    expect(insertSteps(t, 50)).toStrictEqual([
      {
        tree: t,
        highlight: { visited: [50], found: 50, edges: [] },
        text: '50 is already in the tree. Duplicates are not added, so nothing changes.',
        line: LINES.insert.duplicate,
      },
    ]);
  });

  it('a duplicate deeper down is reached by the usual comparisons first', () => {
    const steps = insertSteps(t, 60);
    expect(steps.map((s) => s.text)).toStrictEqual([
      'Start at the root, 50. 60 is larger than 50, so go right.',
      'Now at 70. 60 is smaller than 70, so go left.',
      '60 is already in the tree. Duplicates are not added, so nothing changes.',
    ]);
    for (const step of steps) expect(step.tree).toBe(t);
  });

  it('inserting into the empty tree makes the key the root', () => {
    const steps = insertSteps(null, 50);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toStrictEqual({
      tree: null,
      highlight: { slot: { parent: null, side: null } },
      text: 'The tree is empty, so 50 goes at the root.',
      line: LINES.insert.empty,
    });
    expect(toShape(steps[1]?.tree ?? null)).toStrictEqual([50]);
    expect(steps[1]?.highlight).toStrictEqual({ found: 50, edges: [] });
    expect(steps[1]?.text).toBe('50 becomes the root. It is the only node.');
  });
});

describe('insertSteps agrees with insert, for every key from 1 to 99', () => {
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['U', U_SHAPE],
  ];

  it.each(trees)('in %s', (_name, shape) => {
    const tree = fromShape(shape);
    for (let key = 1; key <= 99; key++) {
      const result = search(tree, key);
      const steps = insertSteps(tree, key);

      expectValidSteps(steps, PSEUDOCODE.insert);
      expectVisitedIsPath(steps);

      if (result.found) {
        // Comparisons up to the duplicate, and the tree never changes.
        expect(steps).toHaveLength(result.path.length);
        for (const step of steps) expect(step.tree).toBe(tree);
        expect(steps.at(-1)?.line).toBe(LINES.insert.duplicate);
      } else {
        // Comparisons, the empty spot, then the new tree.
        expect(steps).toHaveLength(result.path.length + 2);
        for (const step of steps.slice(0, -1)) expect(step.tree).toBe(tree);
        expect(sameTree(steps.at(-1)?.tree ?? null, insert(tree, key).tree)).toBe(true);
        expect(steps.at(-2)?.highlight.slot).toStrictEqual({ parent: result.endAt, side: result.side });
        expect(steps.at(-1)?.highlight.found).toBe(key);
      }

      // The text says what the highlighted pseudocode line does.
      for (const step of steps) {
        const says = {
          [LINES.insert.goLeft]: 'so go left.',
          [LINES.insert.goRight]: 'so go right.',
          [LINES.insert.duplicate]: 'already in the tree',
        }[step.line ?? -1];
        if (says !== undefined) expect(step.text).toContain(says);
      }
    }
  });
});

describe('guards', () => {
  it('rejects a key that is not a whole number', () => {
    expect(() => insertSteps(t, 2.5)).toThrow(RangeError);
  });

  it('never changes the tree it is given', () => {
    insertSteps(t, 65);
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });
});