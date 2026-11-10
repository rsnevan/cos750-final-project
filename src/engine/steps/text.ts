/**
  Small helpers shared by the step builders. Internal: not exported from the
  engine's index.
 */
import type { Highlight, Step } from './types';

// "1 comparison", "3 comparisons".
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// The parent-child edges along a path of keys: [50, 70, 60] gives [[50, 70], [70, 60]].
export function pathEdges(path: readonly number[]): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 1; i < path.length; i++) {
    edges.push([path[i - 1] as number, path[i] as number]);
  }
  return edges;
}

/**
  Make a step and freeze it, its highlight and every list inside, so the
  visualiser's JavaScript can't change a frame by accident. Fields that are
  'undefined' are left out, so a highlight only has the fields that apply.
 */
export function makeStep(step: Step): Step {
  const highlight: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(step.highlight)) {
    if (value === undefined) continue;
    highlight[name] = deepFreeze(value);
  }
  const frozen: Step = {
    tree: step.tree,
    highlight: Object.freeze(highlight) as Highlight,
    text: step.text,
    ...(step.line === undefined ? {} : { line: step.line }),
  };
  return Object.freeze(frozen);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}