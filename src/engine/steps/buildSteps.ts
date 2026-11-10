/**
  Steps for animating building a tree from a list of keys (Lesson 3).
  One frame per key, showing the tree after that key is inserted.
 
  The comparisons are written in words ("smaller than 40") rather than
  symbols ("< 40"), because every caption is also announced by screen readers
  and read aloud by narration, which don't say symbols reliably.
 */
import { insert } from '../insert';
import { search } from '../search';
import type { Tree } from '../types';
import { makeStep, pathEdges } from './text';
import type { Step } from './types';

/**
  The comparisons along a path, kept short enough to read aloud:
  - up to 3 (every lesson tree): "10 is smaller than 40, then smaller than 20";
  - 4 to 6: "30 is compared with 50, 10, 40 and 20";
  - more: "90 is compared with 8 nodes on the way down".
 */
function comparisonsInWords(key: number, path: readonly number[]): string {
  if (path.length <= 3) {
    const parts = path.map((nodeKey, i) => {
      const relation = `${key < nodeKey ? 'smaller' : 'larger'} than ${nodeKey}`;
      return i === 0 ? `${key} is ${relation}` : `then ${relation}`;
    });
    return parts.join(', ');
  }
  if (path.length <= 6) {
    return `${key} is compared with ${path.slice(0, -1).join(', ')} and ${path.at(-1)}`;
  }
  return `${key} is compared with ${path.length} nodes on the way down`;
}

/** The animation of inserting `keys` in order into an empty tree. */
export function buildSteps(keys: readonly number[]): Step[] {
  if (keys.length === 0) {
    return [makeStep({ tree: null, highlight: {}, text: 'There are no keys to insert, so the tree is empty.' })];
  }

  const steps: Step[] = [];
  let tree: Tree = null;

  for (const key of keys) {
    const result = search(tree, key); // also rejects keys that aren't whole numbers

    if (result.found) {
      steps.push(
        makeStep({
          tree,
          highlight: { visited: result.path, found: key, edges: pathEdges(result.path) },
          text: `Insert ${key}. ${key} is already in the tree, so nothing changes.`,
        }),
      );
      continue;
    }

    const how =
      tree === null
        ? `The tree is empty, so ${key} becomes the root.`
        : `${comparisonsInWords(key, result.path)}: the ${result.side} side of ${result.endAt} is empty, so ${key} goes there.`;

    tree = insert(tree, key).tree;
    steps.push(
      makeStep({
        tree,
        highlight: { visited: result.path, found: key, edges: pathEdges([...result.path, key]) },
        text: `Insert ${key}. ${how}`,
      }),
    );
  }

  return steps;
}