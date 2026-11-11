/**
  Steps for animating search (Lesson 2): one step per comparison, then one
  for the empty spot if the key isn't there.
 */
import { search } from '../search';
import type { Tree } from '../types';
import { comparisonStep } from './comparisons';
import { LINES } from './pseudocode';
import { makeStep, pathEdges, plural } from './text';
import type { Step } from './types';

const L = LINES.search;

// The animation of searching for 'key'. Every step shows the same tree.
export function searchSteps(tree: Tree, key: number): Step[] {
  const result = search(tree, key); // also rejects keys that aren't whole numbers

  if (tree === null) {
    return [
      makeStep({
        tree,
        highlight: { visited: [], edges: [], slot: { parent: null, side: null } },
        text: `The tree is empty, so ${key} is not in the tree.`,
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
      text: `${key} equals ${nodeKey}: found it after ${plural(i + 1, 'comparison')}.`,
      line: L.equal,
    });
  });

  if (!result.found) {
    steps.push(
      makeStep({
        tree,
        highlight: {
          visited: result.path,
          edges: pathEdges(result.path),
          slot: { parent: result.endAt, side: result.side },
        },
        text: `The ${result.side} side of ${result.endAt} is empty, so ${key} is not in the tree. ${plural(result.path.length, 'node')} visited.`,
        line: L.empty,
      }),
    );
  }

  return steps;
}