import { describe, expect, it } from 'vitest';
import { allowedRange, build, emptySlots, fromShape, inorder, insert, search, size, toShape } from '../../src/engine';
import type { Shape, Slot } from '../../src/engine';
import { T2_SHAPE, T_SHAPE, U_SHAPE } from './fixtures';

const t = fromShape(T_SHAPE);

describe('emptySlots', () => {
  it('lists the 8 empty spots of T, left to right', () => {
    expect(emptySlots(t)).toStrictEqual([
      { parent: 20, side: 'left' },
      { parent: 20, side: 'right' },
      { parent: 40, side: 'left' },
      { parent: 40, side: 'right' },
      { parent: 60, side: 'left' },
      { parent: 60, side: 'right' },
      { parent: 80, side: 'left' },
      { parent: 80, side: 'right' },
    ]);
  });

  it('lists the empty spots of U, including the one beside 22 under 25', () => {
    expect(emptySlots(fromShape(U_SHAPE))).toStrictEqual([
      { parent: 10, side: 'left' },
      { parent: 10, side: 'right' },
      { parent: 22, side: 'left' },
      { parent: 22, side: 'right' },
      { parent: 25, side: 'right' },
      { parent: 45, side: 'left' },
      { parent: 45, side: 'right' },
      { parent: 60, side: 'left' },
      { parent: 60, side: 'right' },
    ]);
  });

  it('has one spot, the root, for the empty tree, and two for a single node', () => {
    expect(emptySlots(null)).toStrictEqual([{ parent: null, side: null }]);
    expect(emptySlots(fromShape([50]))).toStrictEqual([
      { parent: 50, side: 'left' },
      { parent: 50, side: 'right' },
    ]);
  });

  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
    ['a one-sided chain', [10, null, [20, null, [30]]]],
  ];

  it.each(trees)('%s has one more empty spot than it has nodes', (_name, shape) => {
    const tree = fromShape(shape);
    expect(emptySlots(tree)).toHaveLength(size(tree) + 1);
  });
});

describe('allowedRange', () => {
  // Lesson 1 Try it, corrected: in T the spot left of 70 is taken by 60.
  // The empty spot there is to the right of 60, and it allows 61 to 69.
  it('the empty spot right of 60 in T allows 61 to 69, so 65 fits (Lesson 1 Try it)', () => {
    expect(allowedRange(t, { parent: 60, side: 'right' })).toStrictEqual({ lo: 61, hi: 69 });
  });

  it('the empty spot left of 60 in T allows 51 to 59', () => {
    expect(allowedRange(t, { parent: 60, side: 'left' })).toStrictEqual({ lo: 51, hi: 59 });
  });

  it('the empty spot right of 40 in T allows 41 to 49, which is where 45 goes to make T2', () => {
    expect(allowedRange(t, { parent: 40, side: 'right' })).toStrictEqual({ lo: 41, hi: 49 });
  });

  it('the outermost spots are open on one side', () => {
    expect(allowedRange(t, { parent: 20, side: 'left' })).toStrictEqual({ lo: null, hi: 19 });
    expect(allowedRange(t, { parent: 80, side: 'right' })).toStrictEqual({ lo: 81, hi: null });
  });

  it('any key fits the root of the empty tree', () => {
    expect(allowedRange(null, { parent: null, side: null })).toStrictEqual({ lo: null, hi: null });
  });

  it('gives lo greater than hi when no whole number fits', () => {
    // Between 30 and 31 there is no whole number.
    const { lo, hi } = allowedRange(build([30, 31]), { parent: 31, side: 'left' });
    expect(lo).toBe(31);
    expect(hi).toBe(30);
  });
});

describe('empty spots, ranges, search and insert all agree', () => {
  const trees: [string, Shape][] = [
    ['T', T_SHAPE],
    ['T2', T2_SHAPE],
    ['U', U_SHAPE],
  ];

  it.each(trees)('in %s, each spot allows exactly the keys between its neighbours in-order', (_name, shape) => {
    const tree = fromShape(shape);
    const keys = inorder(tree);
    emptySlots(tree).forEach((slot, i) => {
      const before = keys[i - 1];
      const after = keys[i];
      expect(allowedRange(tree, slot)).toStrictEqual({
        lo: before === undefined ? null : before + 1,
        hi: after === undefined ? null : after - 1,
      });
    });
  });

  it.each(trees)(
    'in %s, every missing key from 1 to 99 fits exactly one spot: the one where its search stops',
    (_name, shape) => {
      const tree = fromShape(shape);
      for (let key = 1; key <= 99; key++) {
        const result = search(tree, key);
        if (result.found) continue;
        const fitting = emptySlots(tree).filter((slot) => {
          const { lo, hi } = allowedRange(tree, slot);
          return (lo === null || key >= lo) && (hi === null || key <= hi);
        });
        expect(fitting).toStrictEqual([{ parent: result.endAt, side: result.side }]);
      }
    },
  );

  it('inserting a key fills its spot and adds two new empty spots under it', () => {
    const before = emptySlots(t);
    const after = emptySlots(insert(t, 65).tree);
    expect(after).toHaveLength(before.length + 1);
    expect(after).not.toContainEqual({ parent: 60, side: 'right' });
    expect(after).toContainEqual({ parent: 65, side: 'left' });
    expect(after).toContainEqual({ parent: 65, side: 'right' });
  });
});

describe('allowedRange rejects spots that are not empty', () => {
  it('rejects the spot left of 70 in T, because 60 is there (the original Lesson 1 Try it)', () => {
    expect(() => allowedRange(t, { parent: 70, side: 'left' })).toThrow(RangeError);
  });

  it('rejects a parent that is not in the tree', () => {
    expect(() => allowedRange(t, { parent: 65, side: 'left' })).toThrow(RangeError);
  });

  it('rejects the root spot of a tree that is not empty', () => {
    expect(() => allowedRange(t, { parent: null, side: null })).toThrow(RangeError);
  });

  it('rejects a side that is not left or right, which JavaScript code could pass', () => {
    expect(() => allowedRange(t, { parent: 60, side: 'up' } as unknown as Slot)).toThrow(RangeError);
  });

  it('rejects a parent key that is not a whole number', () => {
    expect(() => allowedRange(t, { parent: 2.5, side: 'left' })).toThrow(RangeError);
  });
});

describe('immutability', () => {
  it('never changes the tree it is given', () => {
    emptySlots(t);
    allowedRange(t, { parent: 60, side: 'right' });
    expect(toShape(t)).toStrictEqual(T_SHAPE);
  });
});