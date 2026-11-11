/**
  Steps for animating finding the minimum or maximum (Lesson 3): keep going
  left (or right) until there is no child on that side. Wording from the V3
  wireframe. There is no pseudocode for this one, so steps have no `line`.
 */
import { maxPath, minPath } from '../extremes';
import type { Tree } from '../types';
import { makeStep, pathEdges } from './text';
import type { Step } from './types';

// The animation of finding the minimum (`'min'`) or maximum (`'max'`).
export function extremeSteps(tree: Tree, which: 'min' | 'max'): Step[] {
  if (which !== 'min' && which !== 'max') {
    throw new RangeError(`extremeSteps needs 'min' or 'max', but got ${String(which)}`);
  }
  const side = which === 'min' ? 'left' : 'right';
  const name = which === 'min' ? 'minimum' : 'maximum';

  if (tree === null) {
    return [makeStep({ tree, highlight: {}, text: `The tree is empty, so it has no ${name}.` })];
  }

  const path = which === 'min' ? minPath(tree) : maxPath(tree);

  return path.map((key, i) => {
    const visited = path.slice(0, i + 1);
    const edges = pathEdges(visited);

    if (i === path.length - 1) {
      return makeStep({
        tree,
        highlight: { visited, found: key, edges },
        text: `${key} has no ${side} child, so ${key} is the ${name}. No comparisons were needed.`,
      });
    }

    const where = i === 0 ? `Start at the root, ${key}.` : `At ${key}.`;
    return makeStep({
      tree,
      highlight: { visited, current: key, edges },
      text: `${where} It has a ${side} child, so keep going ${side}.`,
    });
  });
}