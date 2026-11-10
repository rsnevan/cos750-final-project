/**
  Rules every animation step must follow, whichever builder made it.
  Each step builder's tests call `expectValidSteps` on everything it produces.
 */
import { expect } from 'vitest';
import { contains, parentOf } from '../../../src/engine';
import type { Highlight, Step } from '../../../src/engine';

// Every key a highlight points at, which must be a node in that step's tree.
function keysPointedAt(h: Highlight): number[] {
  return [
    ...(h.visited ?? []),
    ...(h.current === undefined ? [] : [h.current]),
    ...(h.found === undefined ? [] : [h.found]),
    ...(h.offender === undefined ? [] : [h.offender]),
    ...(h.outlined ?? []),
    ...(h.dimmed ?? []),
    ...(h.edges ?? []).flat(),
    ...Object.keys(h.tags ?? {}).map(Number),
    ...(h.slot?.parent === undefined || h.slot.parent === null ? [] : [h.slot.parent]),
    ...(h.marker === undefined ? [] : [h.marker.key]),
    ...Object.keys(h.relabel ?? {}).map(Number),
    ...(h.ghost === undefined ? [] : [h.ghost]),
  ];
}

export function expectValidSteps(steps: Step[], pseudocode: readonly string[]): void {
  expect(steps.length).toBeGreaterThan(0);

  for (const step of steps) {
    expect(Object.isFrozen(step)).toBe(true);
    expect(Object.isFrozen(step.highlight)).toBe(true);

    // Short, finished text that works when read aloud with no picture.
    expect(step.text.length).toBeGreaterThan(0);
    expect(step.text.length).toBeLessThanOrEqual(220);
    expect(step.text).toMatch(/[.!?]$/);
    expect(step.text).not.toMatch(/undefined|null|NaN/);

    // The pseudocode line, if any, exists.
    if (step.line !== undefined) {
      expect(Number.isInteger(step.line)).toBe(true);
      expect(step.line).toBeGreaterThanOrEqual(0);
      expect(step.line).toBeLessThan(pseudocode.length);
    }

    // Everything highlighted is really in this step's tree.
    for (const key of keysPointedAt(step.highlight)) {
      expect(contains(step.tree, key), `highlighted key ${key} is not in the tree`).toBe(true);
    }

    // Emphasised edges are real parent-child links.
    for (const [parent, child] of step.highlight.edges ?? []) {
      expect(parentOf(step.tree, child)).toBe(parent);
    }

    // A visited list is a path down the tree: each node is the parent of the next.
    const visited = step.highlight.visited ?? [];
    for (let i = 1; i < visited.length; i++) {
      expect(parentOf(step.tree, visited[i] as number)).toBe(visited[i - 1]);
    }

    // A slot is a genuinely empty spot in this step's tree.
    const slot = step.highlight.slot;
    if (slot !== undefined && slot.parent !== null) {
      expect(contains(step.tree, slot.parent)).toBe(true);
    }
  }
}