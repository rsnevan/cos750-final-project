/**
  Steps for animating insert (Lesson 3): the same comparisons as search,
  then the empty spot, then the new tree with the new leaf.
 */
import { insert } from '../insert';
import { search } from '../search';
import type { Tree } from '../types';
import { comparisonStep } from './comparisons';
import { LINES } from './pseudocode';
import { makeStep, pathEdges } from './text';
import type { Step } from './types';

const L = LINES.insert;

// The animation of inserting 'key'. Only the last step shows the new tree.
export function insertSteps(tree: Tree, key: number): Step[] {
  const result = search(tree, key); // also rejects keys that aren't whole numbers

  if (tree === null) {
    return [
      makeStep({
        tree,
        highlight: { slot: { parent: null, side: null } },
        text: `The tree is empty, so ${key} goes at the root.`,
        line: L.empty,
      }),
      makeStep({
        tree: insert(tree, key).tree,
        highlight: { found: key, edges: [] },
        text: `${key} becomes the root. It is the only node.`,
        line: L.empty,
      }),
    ];
  }

  const steps = result.path.map((nodeKey, i) => {
    if (nodeKey !== key) return comparisonStep(tree, key, result.path, i, L);
    const visited = result.path.slice(0, i + 1);
    return makeStep({
      tree,
      highlight: { visited, found: key, edges: pathEdges(visited) },
      text: `${key} is already in the tree. Duplicates are not added, so nothing changes.`,
      line: L.duplicate,
    });
  });

  if (result.found) return steps;

  steps.push(
    makeStep({
      tree,
      highlight: {
        visited: result.path,
        edges: pathEdges(result.path),
        slot: { parent: result.endAt, side: result.side },
      },
      text: `The ${result.side} side of ${result.endAt} is empty. This is where ${key} goes.`,
      line: L.empty,
    }),
    makeStep({
      tree: insert(tree, key).tree,
      highlight: { found: key, edges: pathEdges([...result.path, key]) },
      text: `${key} becomes the ${result.side} child of ${result.endAt}. It is a new leaf, and no other node moved.`,
      line: L.empty,
    }),
  );

  return steps;
}