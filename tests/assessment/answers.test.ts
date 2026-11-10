import { describe, expect, it } from 'vitest';
import {
  emptyResponse,
  isComplete,
  isCorrect,
  isQuestionComplete,
  isQuestionCorrect,
  type Part,
  type Response,
} from '../../src/assessment';

// Parts taken from the lesson plan's activity tables, on tree T (50, 30, 70, 20, 40, 60, 80).
const rootAndLeaves: Part = { type: 'clickSet', answer: [50, 20, 40, 60, 80] }; // L1 item 1
const isValid: Part = { type: 'pick', options: ['Valid', 'Invalid'], answer: 1 }; // L1 item 4
const offender: Part = { type: 'clickOne', answer: 40, optional: true }; // L1 item 4
const searchPath: Part = { type: 'clickPath', answer: [50, 30, 20] }; // L2 item 1
const inorder: Part = { type: 'order', cards: [50, 30, 70, 20, 40, 60, 80], answer: [20, 30, 40, 50, 60, 70, 80] }; // L4 item 1
const insert10: Part = { type: 'slot', answer: { parent: 20, side: 'left' } }; // L3 item 1

describe('empty responses', () => {
  it('starts every part with nothing chosen', () => {
    expect(emptyResponse(isValid)).toEqual({ type: 'pick', choice: null });
    expect(emptyResponse(offender)).toEqual({ type: 'clickOne', node: null });
    expect(emptyResponse(rootAndLeaves)).toEqual({ type: 'clickSet', nodes: [] });
    expect(emptyResponse(searchPath)).toEqual({ type: 'clickPath', nodes: [] });
    expect(emptyResponse(inorder)).toEqual({ type: 'order', cards: [] });
    expect(emptyResponse(insert10)).toEqual({ type: 'slot', slot: null });
  });

  it('is never complete', () => {
    for (const p of [isValid, offender, rootAndLeaves, searchPath, inorder, insert10]) {
      expect(isComplete(p, emptyResponse(p))).toBe(false);
    }
  });
});

describe('pick an option', () => {
  it('is correct only for the right option', () => {
    expect(isCorrect(isValid, { type: 'pick', choice: 1 })).toBe(true);
    expect(isCorrect(isValid, { type: 'pick', choice: 0 })).toBe(false);
  });
});

describe('click nodes', () => {
  it('clickOne: one node', () => {
    expect(isCorrect(offender, { type: 'clickOne', node: 40 })).toBe(true);
    expect(isCorrect(offender, { type: 'clickOne', node: 70 })).toBe(false);
  });

  it('clickSet: the right nodes in any order', () => {
    expect(isCorrect(rootAndLeaves, { type: 'clickSet', nodes: [80, 60, 50, 40, 20] })).toBe(true);
    expect(isCorrect(rootAndLeaves, { type: 'clickSet', nodes: [50, 20, 40, 60] })).toBe(false); // one missing
    expect(isCorrect(rootAndLeaves, { type: 'clickSet', nodes: [50, 20, 40, 60, 80, 30] })).toBe(false); // one extra
  });

  it('clickPath: the right nodes in the right order', () => {
    expect(isCorrect(searchPath, { type: 'clickPath', nodes: [50, 30, 20] })).toBe(true);
    expect(isCorrect(searchPath, { type: 'clickPath', nodes: [30, 50, 20] })).toBe(false);
    expect(isCorrect(searchPath, { type: 'clickPath', nodes: [50, 30] })).toBe(false);
  });
});

describe('drag cards into order', () => {
  it('is complete only when every card is placed', () => {
    expect(isComplete(inorder, { type: 'order', cards: [20, 30, 40] })).toBe(false);
    expect(isComplete(inorder, { type: 'order', cards: [20, 30, 40, 50, 60, 70, 80] })).toBe(true);
  });

  it('is correct only in the exact order', () => {
    expect(isCorrect(inorder, { type: 'order', cards: [20, 30, 40, 50, 60, 70, 80] })).toBe(true);
    expect(isCorrect(inorder, { type: 'order', cards: [50, 30, 20, 40, 70, 60, 80] })).toBe(false); // pre-order
  });
});

describe('place a key on a slot', () => {
  it('is correct only for the right parent and side', () => {
    expect(isCorrect(insert10, { type: 'slot', slot: { parent: 20, side: 'left' } })).toBe(true);
    expect(isCorrect(insert10, { type: 'slot', slot: { parent: 20, side: 'right' } })).toBe(false);
    expect(isCorrect(insert10, { type: 'slot', slot: { parent: 40, side: 'left' } })).toBe(false);
  });

  it('handles the root slot of an empty tree', () => {
    const first: Part = { type: 'slot', answer: { parent: null, side: null } };
    expect(isCorrect(first, { type: 'slot', slot: { parent: null, side: null } })).toBe(true);
  });
});

describe('mismatched responses', () => {
  it('refuses a response of the wrong type', () => {
    expect(() => isCorrect(isValid, { type: 'clickOne', node: 1 })).toThrow();
    expect(() => isComplete(isValid, { type: 'clickOne', node: 1 })).toThrow();
  });
});

describe('whole questions', () => {
  // L1 item 4: tree X is invalid; click the node that breaks the rule (optional part).
  const item4 = [isValid, offender] as const;

  it('can be checked once every required part is answered', () => {
    const responses: Response[] = [{ type: 'pick', choice: 1 }, { type: 'clickOne', node: null }];
    expect(isQuestionComplete(item4, responses)).toBe(true);
  });

  it('is correct only when every part, including optional ones, is correct', () => {
    expect(isQuestionCorrect(item4, [{ type: 'pick', choice: 1 }, { type: 'clickOne', node: 40 }])).toBe(true);
    expect(isQuestionCorrect(item4, [{ type: 'pick', choice: 1 }, { type: 'clickOne', node: null }])).toBe(false);
    expect(isQuestionCorrect(item4, [{ type: 'pick', choice: 0 }, { type: 'clickOne', node: 40 }])).toBe(false);
  });

  it('refuses a response list of the wrong length', () => {
    expect(() => isQuestionCorrect(item4, [{ type: 'pick', choice: 1 }])).toThrow();
  });
});

// "Build a tree" (L3 item 4) compares trees with the engine's sameTree, which
// isn't written yet. Un-skip these once engine feature 9 is merged.
describe.skip('build a tree (needs the engine)', () => {
  it('is complete once every key is placed, and correct for the right shape', async () => {
    const { build } = await import('../../src/engine');
    const part: Part = { type: 'build', keys: [40, 20, 60, 10], answer: build([40, 20, 60, 10]) };
    const placed = { type: 'build', placed: [40, 20, 60, 10], tree: build([40, 20, 60, 10]) } as const;
    expect(isComplete(part, { type: 'build', placed: [40, 20], tree: build([40, 20]) })).toBe(false);
    expect(isComplete(part, placed)).toBe(true);
    expect(isCorrect(part, placed)).toBe(true);
    expect(isCorrect(part, { type: 'build', placed: [40, 20, 10, 60], tree: build([40, 10, 20, 60]) })).toBe(false);
  });
});
