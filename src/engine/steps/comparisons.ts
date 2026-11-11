/**
  The comparison step that search, insert and delete all share:
  "Now at 70. 60 is smaller than 70, so go left."
  Internal: not exported from the engine's index.
 */
import type { Tree } from '../types';
import { makeStep, pathEdges } from './text';
import type { Step } from './types';

/**
  The step for comparing 'key' with the node at 'path[index]' and moving on.
  'goLeft' and 'goRight' are the pseudocode lines for each direction, which
  differ between search, insert and delete.
 */
export function comparisonStep(
  tree: Tree,
  key: number,
  path: readonly number[],
  index: number,
  lines: { goLeft: number; goRight: number },
): Step {
  const nodeKey = path[index] as number;
  const visited = path.slice(0, index + 1);
  const goesLeft = key < nodeKey;
  const where = index === 0 ? `Start at the root, ${nodeKey}.` : `Now at ${nodeKey}.`;
  return makeStep({
    tree,
    highlight: { visited, current: nodeKey, edges: pathEdges(visited) },
    text: `${where} ${key} is ${goesLeft ? 'smaller' : 'larger'} than ${nodeKey}, so go ${goesLeft ? 'left' : 'right'}.`,
    line: goesLeft ? lines.goLeft : lines.goRight,
  });
}