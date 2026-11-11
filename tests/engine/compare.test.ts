import { describe, expect, it } from 'vitest';
import {
  build,
  checkBST,
  findOffenders,
  fromShape,
  inorder,
  insert,
  mapKeys,
  max,
  min,
  postorder,
  preorder,
  remove,
  sameTree,
  search,
  successor,
  toShape,
} from '../../src/engine';
import type { Shape, Tree, TreeNode } from '../../src/engine';
import { T2_SHAPE, T_SHAPE, U_SHAPE, V_SHAPE, X_SHAPE } from './fixtures';

const t = fromShape(T_SHAPE);

// Every node in a tree, so a test can check something about all of them.
function allNodes(tree: Tree): TreeNode[] {
  if (tree === null) return [];
  return [tree, ...allNodes(tree.left), ...allNodes(tree.right)];
}

describe('sameTree', () => {
  it('is true for two separately built copies of T', () => {
    expect(sameTree(build([50, 30, 70, 20, 40, 60, 80]), fromShape(T_SHAPE))).toBe(true);
  });

  it('is true for a tree and itself, and for two empty trees', () => {
    expect(sameTree(t, t)).toBe(true);
    expect(sameTree(null, null)).toBe(true);
  });

  it('is false for an empty tree and a non-empty one, either way round', () => {
    expect(sameTree(null, t)).toBe(false);
    expect(sameTree(t, null)).toBe(false);
  });

  it('is false for the same keys in a different shape', () => {
    expect(sameTree(build([50, 30, 70]), build([30, 50, 70]))).toBe(false);
  });

  it('is false for the same shape with a different key', () => {
    expect(sameTree(fromShape([50, [30], [70]]), fromShape([50, [30], [75]]))).toBe(false);
  });

  it('tells a left child from a right child', () => {
    expect(sameTree(fromShape([50, [30]]), fromShape([50, null, [30]]))).toBe(false);
  });

  it('gives the same answer whichever tree comes first', () => {
    const a = build([40, 20, 60]);
    const b = build([40, 20, 60, 10]);
    expect(sameTree(a, b)).toBe(sameTree(b, a));
  });

  // Marking Lesson 3, item 4 ("build a BST by inserting 40, 20, 60, 10").
  it('accepts a different insertion order that gives the same tree, and rejects one that does not', () => {
    const answer = build([40, 20, 60, 10]);
    expect(sameTree(build([40, 60, 20, 10]), answer)).toBe(true);
    expect(sameTree(build([40, 10, 20, 60]), answer)).toBe(false);
  });

  it('marks a delete answer: the student\'s tree after deleting 30 against the expected one', () => {
    expect(sameTree(remove(t, 30).tree, fromShape([50, [40, [20]], [70, [60], [80]]]))).toBe(true);
  });
});

describe('mapKeys keeps the shape and changes the keys', () => {
  it('adding 7 to every key of T gives the same shape with keys 57, 37, 77, ...', () => {
    expect(toShape(mapKeys(t, (k) => k + 7))).toStrictEqual([57, [37, [27], [47]], [77, [67], [87]]]);
  });

  it('the identity gives back an equal tree', () => {
    expect(sameTree(mapKeys(t, (k) => k), t)).toBe(true);
  });

  it('maps the empty tree to the empty tree', () => {
    expect(mapKeys(null, (k) => k + 7)).toBeNull();
  });

  it('maps an invalid tree too, and the same node still breaks the rule', () => {
    // Retakes of Lesson 1 shift trees X and V as well.
    expect(checkBST(mapKeys(fromShape(X_SHAPE), (k) => k + 7)).offender).toBe(47);
    expect(findOffenders(mapKeys(fromShape(V_SHAPE), (k) => k - 7))).toStrictEqual([28]);
  });

  it('only creates frozen nodes, and never changes the tree it is given', () => {
    const mapped = mapKeys(t, (k) => k + 7);
    expect(allNodes(mapped).every((node) => Object.isFrozen(node))).toBe(true);
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });
});

describe('mapKeys refuses functions that would break the tree', () => {
  it('rejects a function that reverses the order of the keys', () => {
    expect(() => mapKeys(t, (k) => 100 - k)).toThrow(RangeError);
  });

  it('rejects a function that sends two keys to the same key', () => {
    expect(() => mapKeys(t, (k) => Math.floor(k / 20))).toThrow(RangeError);
  });

  it('rejects a function that gives keys that are not whole numbers', () => {
    expect(() => mapKeys(t, (k) => k * 1.5 + 0.25)).toThrow(RangeError);
  });

  it('checks the order of the keys themselves, so it works on invalid trees', () => {
    // X's in-order (30 50 40 70) isn't sorted, but adding 7 is still increasing.
    expect(() => mapKeys(fromShape(X_SHAPE), (k) => k + 7)).not.toThrow();
  });
});

// The retake guarantee: every answer on a shifted tree is the shifted original answer.
describe('every answer carries over to a retake', () => {
  const offsets = [0, 7, -7, 13, 3]; // the retake offsets planned for config.json
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
  ];

  describe.each(trees)('on %s', (_name, shape) => {
    const tree = fromShape(shape);

    it.each(offsets)('with offset %i, traversals, minimum and maximum carry over', (offset) => {
      const f = (k: number) => k + offset;
      const mapped = mapKeys(tree, f);
      expect(checkBST(mapped).valid).toBe(true);
      expect(preorder(mapped)).toStrictEqual(preorder(tree).map(f));
      expect(inorder(mapped)).toStrictEqual(inorder(tree).map(f));
      expect(postorder(mapped)).toStrictEqual(postorder(tree).map(f));
      expect(min(mapped)).toBe(f(min(tree) ?? 0));
      expect(max(mapped)).toBe(f(max(tree) ?? 0));
    });

    it.each(offsets)('with offset %i, search, insert, delete and successor carry over for keys 10 to 90', (offset) => {
      const f = (k: number) => k + offset;
      const mapped = mapKeys(tree, f);
      for (let key = 10; key <= 90; key++) {
        const original = search(tree, key);
        const shifted = search(mapped, f(key));
        expect(shifted.path).toStrictEqual(original.path.map(f));
        expect(shifted.found).toBe(original.found);
        expect(shifted.side).toBe(original.side);

        expect(sameTree(insert(mapped, f(key)).tree, mapKeys(insert(tree, key).tree, f))).toBe(true);

        const removedOriginal = remove(tree, key);
        const removedShifted = remove(mapped, f(key));
        expect(sameTree(removedShifted.tree, mapKeys(removedOriginal.tree, f))).toBe(true);
        expect(removedShifted.case).toBe(removedOriginal.case);

        const next = successor(tree, key);
        expect(successor(mapped, f(key))).toBe(next === null ? null : f(next));
      }
    });
  });
});