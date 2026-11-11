/**
  Steps for animating traversals (Lesson 4): one frame per node visited, and
  the marker walk that shows where each order's "dot" sits. 
 */
import type { TraversalOrder } from '../traversal';
import { traverse } from '../traversal';
import type { Tree } from '../types';
import { LINES } from './pseudocode';
import { makeStep } from './text';
import type { MarkerPosition, Step } from './types';

const WHEN: Record<TraversalOrder, string> = {
  pre: 'before its children',
  in: 'between its left and right subtrees',
  post: 'after both of its children',
};

// True when the keys strictly increase.
function isSorted(keys: readonly number[]): boolean {
  return keys.every((key, i) => i === 0 || (keys[i - 1] as number) < key);
}

/**
  The animation of a pre-, in- or post-order traversal. One step per node.
  The last in-order step says whether the list is sorted, which is only true
  for a valid BST, so invalid trees (like X in Lesson 1) are described honestly.
 */
export function traversalSteps(tree: Tree, order: TraversalOrder): Step[] {
  const sequence = traverse(tree, order); // also rejects unknown orders

  if (tree === null) {
    return [
      makeStep({
        tree,
        highlight: { dots: order, output: [] },
        text: 'The tree is empty, so there is nothing to visit.',
        line: LINES.traverse.empty,
      }),
    ];
  }

  return sequence.map((key, i) => {
    const soFar = sequence.slice(0, i + 1);
    let text = `Visit ${key}: ${order}-order writes a node ${WHEN[order]}.`;
    if (i === sequence.length - 1) {
      text += ' Every node has been visited exactly once.';
      if (order === 'in') {
        text += isSorted(sequence)
          ? ' The list is sorted.'
          : ' The list is not sorted, so this tree breaks the BST rule.';
      }
    }
    return makeStep({
      tree,
      highlight: {
        visited: soFar,
        current: key,
        marker: { key, position: order },
        dots: order,
        output: soFar,
      },
      text,
      line: LINES.traverse[order],
    });
  });
}

const PASSES: Record<MarkerPosition, string> = {
  pre: 'left side, on the way down',
  in: 'underside, between its two subtrees',
  post: 'right side, on the way back up',
};

/**
 The marker walk: a marker travels around the outside of the tree, starting
 on the left of the root, and passes each node three times: on its left
 (where pre-order's dot sits), underneath (in-order) and on its right
 (post-order). Reading the walk at one side of every node gives that order.
 */
export function walkSteps(tree: Tree): Step[] {
  if (tree === null) {
    return [makeStep({ tree, highlight: {}, text: 'The tree is empty, so there is nothing to walk around.' })];
  }

  const passes: { key: number; position: MarkerPosition }[] = [];
  (function walk(node: Tree): void {
    if (node === null) return;
    passes.push({ key: node.key, position: 'pre' });
    walk(node.left);
    passes.push({ key: node.key, position: 'in' });
    walk(node.right);
    passes.push({ key: node.key, position: 'post' });
  })(tree);

  return passes.map(({ key, position }) =>
    makeStep({
      tree,
      highlight: { current: key, marker: { key, position } },
      text: `The marker passes ${key} on its ${PASSES[position]}.`,
    }),
  );
}