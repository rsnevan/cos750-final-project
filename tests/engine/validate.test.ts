import { describe, expect, it } from 'vitest';
import { build, checkBST, findOffenders, fromShape, inorder, toShape } from '../../src/engine';
import type { Shape, Tree } from '../../src/engine';
import { T2_SHAPE, T55_SHAPE, T_SHAPE, U_SHAPE, V_SHAPE, W_SHAPE, X_SHAPE } from './fixtures';

/**
  The wrong check from the Lesson 1 misconception: compare each node only with its
  own children. Written here so the tests can show it gives the wrong answer.
 */
function parentOnlyCheck(tree: Tree): boolean {
  if (tree === null) return true;
  if (tree.left !== null && tree.left.key > tree.key) return false;
  if (tree.right !== null && tree.right.key < tree.key) return false;
  return parentOnlyCheck(tree.left) && parentOnlyCheck(tree.right);
}

// True when the keys strictly increase.
function strictlyIncreasing(keys: number[]): boolean {
  return keys.every((key, i) => i === 0 || (keys[i - 1] ?? key) < key);
}

// Answers from the lesson plan's Lesson 1 ("Spot the BST") and final test.
describe('valid trees', () => {
  const validTrees: [string, Shape][] = [
    ['T (Lesson 1, item 3)', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
    ['W, which only looks suspicious (final test, item 3)', W_SHAPE],
  ];

  it.each(validTrees)('%s is a valid BST', (_name, shape) => {
    expect(checkBST(fromShape(shape))).toStrictEqual({ valid: true, offender: null });
  });

  it('the empty tree is a BST (Lesson 1 explanation)', () => {
    expect(checkBST(null)).toStrictEqual({ valid: true, offender: null });
  });

  it('a single node is a BST', () => {
    expect(checkBST(fromShape([50]))).toStrictEqual({ valid: true, offender: null });
  });

  it('every tree built by inserting keys is valid', () => {
    expect(checkBST(build([40, 20, 60, 10])).valid).toBe(true);
    expect(checkBST(build([10, 20, 30])).valid).toBe(true);
  });
});

describe('invalid trees and the node that breaks the rule', () => {
  it('X is invalid, and 40 breaks the rule (Lesson 1, item 4)', () => {
    expect(checkBST(fromShape(X_SHAPE))).toStrictEqual({ valid: false, offender: 40 });
  });

  it('the 55 tree is invalid, and 55 breaks the rule (Lesson 1, item 5)', () => {
    expect(checkBST(fromShape(T55_SHAPE))).toStrictEqual({ valid: false, offender: 55 });
  });

  it('V is invalid, and 35 breaks the rule (final test, item 2)', () => {
    expect(checkBST(fromShape(V_SHAPE))).toStrictEqual({ valid: false, offender: 35 });
  });

  it('finds a violation three levels down, against the root', () => {
    // 55 is under 30, 40 and 45: fine for each of them, but it is in 50's left subtree.
    expect(checkBST(fromShape([50, [30, null, [40, null, [45, null, [55]]]], [70]]))).toStrictEqual({
      valid: false,
      offender: 55,
    });
  });
});

describe('checking each parent against its children is not enough (Lesson 1, item 6)', () => {
  const lookFine: [string, Shape][] = [
    ['X', X_SHAPE],
    ['the 55 tree', T55_SHAPE],
    ['V', V_SHAPE],
  ];

  it.each(lookFine)('%s passes the parent-only check but is not a BST', (_name, shape) => {
    const tree = fromShape(shape);
    expect(parentOnlyCheck(tree)).toBe(true);
    expect(checkBST(tree).valid).toBe(false);
  });
});

describe('findOffenders lists every node that breaks the rule', () => {
  it('lists exactly one for each tree in the lessons, so a click-the-node question has one answer', () => {
    expect(findOffenders(fromShape(X_SHAPE))).toStrictEqual([40]);
    expect(findOffenders(fromShape(T55_SHAPE))).toStrictEqual([55]);
    expect(findOffenders(fromShape(V_SHAPE))).toStrictEqual([35]);
  });

  it('lists none for a valid tree', () => {
    expect(findOffenders(fromShape(T_SHAPE))).toStrictEqual([]);
    expect(findOffenders(null)).toStrictEqual([]);
  });

  it('lists both children when they are swapped, and checkBST reports the first in pre-order', () => {
    const swapped = fromShape([50, [70], [30]]);
    expect(findOffenders(swapped)).toStrictEqual([70, 30]);
    expect(checkBST(swapped).offender).toBe(70);
  });

  it('lists a whole misplaced subtree, topmost node first', () => {
    // 40, 35 and 45 are all smaller than 50 but sit in its right subtree.
    const misplaced = fromShape([50, [30], [70, [40, [35], [45]]]]);
    expect(findOffenders(misplaced)).toStrictEqual([40, 35, 45]);
    expect(checkBST(misplaced).offender).toBe(40);
  });
});

describe('the BST rule and in-order agree (Lesson 4, item 6)', () => {
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['W', W_SHAPE],
    ['X', X_SHAPE],
    ['the 55 tree', T55_SHAPE],
    ['V', V_SHAPE],
    ['swapped children', [50, [70], [30]]],
  ];

  it.each(trees)('%s is valid exactly when its in-order keys are increasing', (_name, shape) => {
    const tree = fromShape(shape);
    expect(checkBST(tree).valid).toBe(strictlyIncreasing(inorder(tree)));
  });
});

describe('immutability', () => {
  it('never changes the tree it is given', () => {
    const x = fromShape(X_SHAPE);
    checkBST(x);
    findOffenders(x);
    expect(toShape(x)).toStrictEqual(X_SHAPE);
  });
});