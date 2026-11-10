import { describe, expect, it } from 'vitest';
import {
  build,
  deleteSteps,
  fromShape,
  inorder,
  LINES,
  PSEUDOCODE,
  remove,
  sameTree,
  toShape,
} from '../../../src/engine';
import type { Shape } from '../../../src/engine';
import { T2_SHAPE, T_SHAPE, U_SHAPE } from '../fixtures';
import { expectValidSteps } from './stepRules';

const t = fromShape(T_SHAPE);
const t2 = fromShape(T2_SHAPE);
const u = fromShape(U_SHAPE);

describe('case 1: a leaf (Lesson 5 worked example, delete 20 from T)', () => {
  const steps = () => deleteSteps(t, 20);

  it('finds it, names the case, removes it and checks the rule', () => {
    expect(steps().map((s) => s.text)).toStrictEqual([
      'First, find 20 with search: 50, 30, 20.',
      '20 has no children. This is case 1, a leaf.',
      'Remove 20. Nothing else moves.',
      'Check: the in-order sequence 30 40 50 60 70 80 is still sorted, so the BST rule holds.',
    ]);
  });

  it('highlights the search path first, and shows the new tree once 20 is removed', () => {
    expect(steps()[0]).toStrictEqual({
      tree: t,
      highlight: { visited: [50, 30, 20], current: 20, edges: [[50, 30], [30, 20]] },
      text: 'First, find 20 with search: 50, 30, 20.',
    });
    expect(steps()[1]?.tree).toBe(t);
    expect(steps()[1]?.line).toBe(LINES.delete.leftEmpty);
    expect(toShape(steps()[2]?.tree ?? null)).toStrictEqual([50, [30, null, [40]], [70, [60], [80]]]);
    expect(steps()[3]?.line).toBe(LINES.delete.done);
  });
});

describe('case 2: one child (Lesson 5, item 2: delete 40 from T2)', () => {
  const steps = () => deleteSteps(t2, 40);

  it('names the child, moves it up and checks the rule', () => {
    expect(steps().map((s) => s.text)).toStrictEqual([
      'First, find 40 with search: 50, 30, 40.',
      '40 has one child, 45. This is case 2.',
      "Replace 40 with its child: 45 and everything below it move up into 40's place.",
      'Check: the in-order sequence 20 30 45 50 60 70 80 is still sorted, so the BST rule holds.',
    ]);
  });

  it('outlines the child before the move, and highlights it after', () => {
    expect(steps()[1]?.highlight).toStrictEqual({ current: 40, outlined: [45] });
    expect(steps()[1]?.line).toBe(LINES.delete.leftEmpty); // 40's left is empty, so its right child takes over
    expect(steps()[2]?.highlight).toStrictEqual({ found: 45 });
    expect(toShape(steps()[2]?.tree ?? null)).toStrictEqual([50, [30, [20], [45]], [70, [60], [80]]]);
  });

  it('uses the "right is empty" line when the only child is on the left', () => {
    // 25 in U has only a left child, 22.
    expect(deleteSteps(u, 25)[1]?.line).toBe(LINES.delete.rightEmpty);
  });
});

describe('case 3: two children, using the successor', () => {
  it('delete 70 from T (worked example): the successor is the right child itself', () => {
    expect(deleteSteps(t, 70).map((s) => s.text)).toStrictEqual([
      'First, find 70 with search: 50, 70.',
      '70 has two children, 60 and 80. This is case 3.',
      "Find the in-order successor: the smallest key in 70's right subtree. Go right to 80. It has no left child, so the successor is 80.",
      'Copy 80 into the node that held 70. The old 80 is now a duplicate and is about to be removed.',
      'Delete the old 80 from the right subtree. It is a leaf, so this is case 1.',
      'Check: the in-order sequence 20 30 40 50 60 80 is still sorted, so the BST rule holds.',
    ]);
  });

  it('delete 50 from T (item 4): go right to 70, then left to 60', () => {
    const steps = deleteSteps(t, 50);
    expect(steps[2]?.text).toBe(
      "Find the in-order successor: the smallest key in 50's right subtree. Go right to 70, then left as far as possible. The successor is 60.",
    );
    // Everything outside 50's right subtree is faded while finding the successor.
    expect(steps[2]?.highlight).toStrictEqual({
      current: 50,
      visited: [70, 60],
      found: 60,
      edges: [[50, 70], [70, 60]],
      dimmed: [30, 20, 40],
    });
    expect(steps[2]?.line).toBe(LINES.delete.successor);
  });

  it('shows the copy without putting 60 in the tree twice: node 50 is shown as 60, the old 60 dashed', () => {
    const copy = deleteSteps(t, 50)[3];
    expect(copy?.tree).toBe(t); // the tree itself hasn't changed yet
    expect(copy?.highlight).toStrictEqual({ relabel: { 50: 60 }, ghost: 60 });
    expect(copy?.line).toBe(LINES.delete.copy);
  });

  it('delete 30 from T2: the old successor 40 has a child, so that delete is case 2', () => {
    const steps = deleteSteps(t2, 30);
    expect(steps[4]?.text).toBe(
      'Delete the old 40 from the right subtree. It has one child, 45, so this is case 2: 45 moves up into its place.',
    );
    expect(toShape(steps[4]?.tree ?? null)).toStrictEqual([50, [40, [20], [45]], [70, [60], [80]]]);
    expect(steps[4]?.line).toBe(LINES.delete.removeSuccessor);
  });

  it('delete 20 from U (final test, item 10): the successor is 22', () => {
    const steps = deleteSteps(u, 20);
    expect(steps[2]?.text).toBe(
      "Find the in-order successor: the smallest key in 20's right subtree. Go right to 25, then left as far as possible. The successor is 22.",
    );
    expect(toShape(steps.at(-1)?.tree ?? null)).toStrictEqual([35, [22, [10], [25]], [50, [45], [60]]]);
  });
});

describe('missing keys and small trees', () => {
  it('a missing key: the search ends at an empty spot and nothing is deleted', () => {
    expect(deleteSteps(t, 65)).toStrictEqual([
      {
        tree: t,
        highlight: { visited: [50, 70, 60], edges: [[50, 70], [70, 60]], slot: { parent: 60, side: 'right' } },
        text: 'Search for 65: 50, 70, 60. The right side of 60 is empty, so 65 is not in the tree and nothing is deleted.',
        line: LINES.delete.empty,
      },
    ]);
  });

  it('the empty tree: nothing to delete', () => {
    expect(deleteSteps(null, 50)).toStrictEqual([
      { tree: null, highlight: {}, text: 'The tree is empty, so there is nothing to delete.', line: LINES.delete.empty },
    ]);
  });

  it('deleting the only node ends with an empty tree', () => {
    const steps = deleteSteps(fromShape([50]), 50);
    expect(steps.at(-1)).toStrictEqual({ tree: null, highlight: {}, text: 'The tree is now empty.', line: LINES.delete.done });
  });
});

describe('deleteSteps agrees with remove, for every key in the lesson trees', () => {
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
  ];
  const caseWords = { leaf: 'case 1', one: 'case 2', two: 'case 3' } as const;

  it.each(trees)('in %s', (_name, shape) => {
    const tree = fromShape(shape);
    for (const key of inorder(tree)) {
      const result = remove(tree, key);
      const steps = deleteSteps(tree, key);

      expectValidSteps(steps, PSEUDOCODE.delete);
      expect(steps).toHaveLength(result.case === 'two' ? 6 : 4);

      // The second step names the same case as remove.
      expect(steps[1]?.text).toContain(`This is ${caseWords[result.case ?? 'leaf']}`);

      // The original tree is shown until the delete happens, then remove's result.
      const changeAt = result.case === 'two' ? 4 : 2;
      steps.slice(0, changeAt).forEach((step) => expect(step.tree).toBe(tree));
      steps.slice(changeAt).forEach((step) => expect(sameTree(step.tree, result.tree)).toBe(true));

      // In case 3, the successor named matches remove's.
      if (result.case === 'two') {
        expect(steps[2]?.highlight.found).toBe(result.successor);
        expect(steps[3]?.highlight.relabel).toStrictEqual({ [key]: result.successor });
      }
    }
  });
});

describe('captions stay short in tall trees', () => {
  // A one-sided chain of 99 keys: every search path is long.
  const chain = build(Array.from({ length: 99 }, (_, i) => i + 1));

  it('a long search path is summarised instead of listed', () => {
    expect(deleteSteps(chain, 79)[0]?.text).toBe('First, find 79 with search: 79 nodes, from 1 down to 79.');
  });

  it('every caption is at most 220 characters, for every key in the chain', () => {
    for (let key = 1; key <= 99; key++) {
      for (const step of deleteSteps(chain, key)) expect(step.text.length).toBeLessThanOrEqual(220);
    }
  });

  it('paths of up to 8 nodes are still listed in full', () => {
    const eight = build([10, 20, 30, 40, 50, 60, 70, 80]);
    expect(deleteSteps(eight, 80)[0]?.text).toBe('First, find 80 with search: 10, 20, 30, 40, 50, 60, 70, 80.');
  });
});

describe('guards', () => {
  it('rejects a key that is not a whole number', () => {
    expect(() => deleteSteps(t, 2.5)).toThrow(RangeError);
  });

  it('never changes the tree it is given', () => {
    for (const key of inorder(t)) deleteSteps(t, key);
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });
});