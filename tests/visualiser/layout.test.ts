import { describe, expect, it } from 'vitest';
import type { Tree } from '../../src/engine';
import { layoutTree } from '../../src/visualiser/layout';

describe('layoutTree', () => {
  it('places nodes in in-order columns and depth rows without overlap', () => {
    const tree: Tree = {
      key: 50,
      left: { key: 30, left: { key: 20, left: null, right: null }, right: { key: 40, left: null, right: null } },
      right: { key: 70, left: { key: 60, left: null, right: null }, right: { key: 80, left: null, right: null } },
    };

    const layout = layoutTree(tree);
    const xByKey = new Map<number, number>();
    const yByKey = new Map<number, number>();
    for (const { key, x, y } of layout.nodes) {
      xByKey.set(key, x);
      yByKey.set(key, y);
    }

    expect(Array.from(xByKey.keys()).sort((a, b) => a - b)).toEqual([20, 30, 40, 50, 60, 70, 80]);
    expect(xByKey.get(20)).toBeLessThan(xByKey.get(30) ?? 0);
    expect(xByKey.get(30)).toBeLessThan(xByKey.get(40) ?? 0);
    expect(xByKey.get(40)).toBeLessThan(xByKey.get(50) ?? 0);
    expect(yByKey.get(50)).toBeLessThan(yByKey.get(30) ?? 0);
    expect(layout.edges).toHaveLength(6);
    expect(layout.slots).toHaveLength(8);
  });

  it('supports empty trees and one-sided trees', () => {
    const empty = layoutTree(null);
    expect(empty.nodes).toEqual([]);
    expect(empty.slots).toEqual([{ parent: null, side: null, x: 180, y: 90 }]);

    const oneSided = layoutTree({
      key: 50,
      left: { key: 30, left: null, right: null },
      right: null,
    });
    expect(oneSided.nodes).toHaveLength(2);
    expect(oneSided.slots).toHaveLength(3);
    expect(oneSided.slots).toContainEqual(expect.objectContaining({ parent: 50, side: 'right' }));
  });

  it('keeps invalid repeated-key nodes independently positioned', () => {
    const layout = layoutTree({
      key: 10,
      left: { key: 10, left: null, right: null },
      right: null,
    });

    expect(layout.nodes).toHaveLength(2);
    expect(new Set(layout.nodes.map(({ id }) => id)).size).toBe(2);
    expect(layout.edges).toHaveLength(1);
    expect(layout.slots).toHaveLength(3);
  });
});
