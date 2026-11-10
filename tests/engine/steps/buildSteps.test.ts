import { describe, expect, it } from 'vitest';
import { build, buildSteps, sameTree, toShape } from '../../../src/engine';
import { T_KEYS, T_SHAPE, U_KEYS, U_SHAPE } from '../fixtures';
import { expectValidSteps } from './stepRules';

describe('buildSteps: one frame per key inserted', () => {
  it('builds 40, 20, 60, 10 as in Lesson 3, item 4', () => {
    const steps = buildSteps([40, 20, 60, 10]);
    expect(steps.map((s) => s.text)).toStrictEqual([
      'Insert 40. The tree is empty, so 40 becomes the root.',
      'Insert 20. 20 is smaller than 40: the left side of 40 is empty, so 20 goes there.',
      'Insert 60. 60 is larger than 40: the right side of 40 is empty, so 60 goes there.',
      'Insert 10. 10 is smaller than 40, then smaller than 20: the left side of 20 is empty, so 10 goes there.',
    ]);
    expect(toShape(steps.at(-1)?.tree ?? null)).toStrictEqual([40, [20, [10]], [60]]);
  });

  it('highlights the comparisons made and the new node in each frame', () => {
    const steps = buildSteps([40, 20, 60, 10]);
    expect(steps[0]?.highlight).toStrictEqual({ visited: [], found: 40, edges: [] });
    expect(steps[3]?.highlight).toStrictEqual({ visited: [40, 20], found: 10, edges: [[40, 20], [20, 10]] });
  });

  it('shows the tree after each insert, so frame i is the tree built from the first i + 1 keys', () => {
    const steps = buildSteps(T_KEYS);
    expect(steps).toHaveLength(T_KEYS.length);
    steps.forEach((step, i) => {
      expect(sameTree(step.tree, build(T_KEYS.slice(0, i + 1)))).toBe(true);
    });
    expect(toShape(steps.at(-1)?.tree ?? null)).toStrictEqual(T_SHAPE);
  });

  it('ends on tree U for the final test keys', () => {
    expect(toShape(buildSteps(U_KEYS).at(-1)?.tree ?? null)).toStrictEqual(U_SHAPE);
  });

  it('says a repeated key changes nothing, and keeps the same tree', () => {
    const steps = buildSteps([50, 30, 50]);
    expect(steps[2]?.text).toBe('Insert 50. 50 is already in the tree, so nothing changes.');
    expect(steps[2]?.tree).toBe(steps[1]?.tree);
    expect(steps[2]?.highlight).toStrictEqual({ visited: [50], found: 50, edges: [] });
  });

  it('keeps captions short in tall trees: keys listed for 4 to 6 comparisons, a count beyond that', () => {
    // Every caption is also read aloud, so a long chain of comparisons is hard to follow.
    const fourDeep = buildSteps([50, 10, 40, 20, 30]).at(-1)?.text;
    expect(fourDeep).toBe('Insert 30. 30 is compared with 50, 10, 40 and 20: the right side of 20 is empty, so 30 goes there.');

    const eightDeep = buildSteps([10, 20, 30, 40, 50, 60, 70, 80, 90]).at(-1)?.text;
    expect(eightDeep).toBe('Insert 90. 90 is compared with 8 nodes on the way down: the right side of 80 is empty, so 90 goes there.');
  });

  it('keeps every caption at most 220 characters, even in a one-sided chain of 99 keys', () => {
    const chain = Array.from({ length: 99 }, (_, i) => i + 1);
    for (const step of buildSteps(chain)) expect(step.text.length).toBeLessThanOrEqual(220);
  });

  it('gives one frame saying the tree is empty when there are no keys', () => {
    expect(buildSteps([])).toStrictEqual([
      { tree: null, highlight: {}, text: 'There are no keys to insert, so the tree is empty.' },
    ]);
  });

  it('follows the rules every step must follow, with no pseudocode line', () => {
    for (const keys of [[40, 20, 60, 10], [...T_KEYS], [...U_KEYS], [10, 20, 30, 40]]) {
      const steps = buildSteps(keys);
      expectValidSteps(steps, []);
      for (const step of steps) expect(step.line).toBeUndefined();
    }
  });

  it('rejects a key that is not a whole number', () => {
    expect(() => buildSteps([50, 2.5])).toThrow(RangeError);
  });
});