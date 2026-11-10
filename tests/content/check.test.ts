import { describe, expect, it } from 'vitest';
import { checkPart, checkQuestion, countsAsCorrect, resolveItem, validateConfig, CONFIG } from '../../src/content';
import type { ItemSpec, Part, PartResponse } from '../../src/content';

// Lesson 2, item 1: searching for 20 in T visits 50, 30, 20.
const PATH: Part = { type: 'click', label: 'Path', mode: 'path', answer: [50, 30, 20] };
// Lesson 2, item 3: the right side of 40 ends a search for 45.
const SIDE: Part = { type: 'pick', label: 'Which side?', options: ['Left', 'Right'], answer: 1 };
const NODE: Part = { type: 'click', label: 'The node', mode: 'one', answer: 40 };
// Lesson 1, item 1: the leaves of T are 20, 40, 60 and 80.
const LEAVES: Part = { type: 'click', label: 'Leaves', mode: 'set', answer: [20, 40, 60, 80] };
// Lesson 4: the in-order sequence of T.
const IN_ORDER: Part = {
  type: 'order',
  label: '',
  cards: [60, 20, 80, 40, 50, 30, 70],
  answer: [20, 30, 40, 50, 60, 70, 80],
};
// Lesson 3, item 5: build a BST by inserting 40, 20, 60, 10.
const BUILD: Part = {
  type: 'place',
  label: '',
  keys: [40, 20, 60, 10],
  answer: [
    { parent: null, side: null },
    { parent: 40, side: 'left' },
    { parent: 40, side: 'right' },
    { parent: 20, side: 'left' },
  ],
};

describe('pick', () => {
  it('is correct for the right option only', () => {
    expect(checkPart(SIDE, 1)).toEqual({ correct: true });
    expect(checkPart(SIDE, 0)).toEqual({ correct: false });
  });

  it('rejects a response that is not one of the options', () => {
    expect(() => checkPart(SIDE, 2)).toThrow(TypeError);
    expect(() => checkPart(SIDE, -1)).toThrow(TypeError);
    expect(() => checkPart(SIDE, 0.5)).toThrow(TypeError);
    expect(() => checkPart(SIDE, [1])).toThrow(TypeError);
  });
});

describe('click one', () => {
  it('is correct for the right node only', () => {
    expect(checkPart(NODE, 40)).toEqual({ correct: true });
    expect(checkPart(NODE, 30)).toEqual({ correct: false });
  });

  it('rejects a list', () => {
    expect(() => checkPart(NODE, [40])).toThrow(TypeError);
  });
});

describe('click path: order matters', () => {
  it('is correct for the exact path', () => {
    expect(checkPart(PATH, [50, 30, 20])).toEqual({ correct: true, onTrack: true });
  });

  it('points at the first wrong node', () => {
    expect(checkPart(PATH, [50, 70, 60])).toEqual({ correct: false, onTrack: false, firstWrong: 1 });
  });

  it('is wrong in any other order, even with the same nodes', () => {
    expect(checkPart(PATH, [20, 30, 50])).toEqual({ correct: false, onTrack: false, firstWrong: 0 });
  });

  it('stays on track while every click so far is right, for step-by-step confirmation', () => {
    expect(checkPart(PATH, [])).toEqual({ correct: false, onTrack: true, firstWrong: 0 });
    expect(checkPart(PATH, [50, 30])).toEqual({ correct: false, onTrack: true, firstWrong: 2 });
  });

  it('is wrong when it carries on past the end, such as stopping at a leaf\'s child', () => {
    expect(checkPart(PATH, [50, 30, 20, 10])).toEqual({ correct: false, onTrack: false, firstWrong: 3 });
  });

  it('rejects a single key or a list with something other than keys', () => {
    expect(() => checkPart(PATH, 50)).toThrow(TypeError);
    expect(() => checkPart(PATH, [50, 2.5])).toThrow(TypeError);
    expect(() => checkPart(PATH, ['50'] as unknown as PartResponse)).toThrow(TypeError);
  });
});

describe('click set: any order', () => {
  it('is correct in any order', () => {
    expect(checkPart(LEAVES, [80, 20, 60, 40])).toEqual({ correct: true, missing: [], extra: [] });
  });

  it('lists the right keys missed and the wrong keys chosen', () => {
    // Checking only the bottom-left: a typical slip is taking 30 for a leaf.
    expect(checkPart(LEAVES, [20, 30, 40])).toEqual({ correct: false, missing: [60, 80], extra: [30] });
  });

  it('ignores a key clicked twice', () => {
    expect(checkPart(LEAVES, [20, 40, 20, 60, 80])).toEqual({ correct: true, missing: [], extra: [] });
  });

  it('is wrong when nothing is chosen', () => {
    expect(checkPart(LEAVES, [])).toEqual({ correct: false, missing: [20, 40, 60, 80], extra: [] });
  });
});

describe('order', () => {
  it('is correct for the right sequence', () => {
    expect(checkPart(IN_ORDER, [20, 30, 40, 50, 60, 70, 80])).toEqual({ correct: true, onTrack: true });
  });

  it('points at the first card out of place', () => {
    // Pre-order instead of in-order.
    expect(checkPart(IN_ORDER, [50, 30, 20, 40, 70, 60, 80])).toEqual({
      correct: false,
      onTrack: false,
      firstWrong: 0,
    });
    expect(checkPart(IN_ORDER, [20, 30, 40, 50, 70, 60, 80])).toEqual({
      correct: false,
      onTrack: false,
      firstWrong: 4,
    });
  });
});

describe('place', () => {
  const right = BUILD.type === 'place' ? BUILD.answer : [];

  it('is correct when every key goes to the right spot', () => {
    expect(checkPart(BUILD, right)).toEqual({ correct: true, onTrack: true });
  });

  it('points at the first key placed wrongly', () => {
    const wrong = [...right];
    wrong[3] = { parent: 20, side: 'right' }; // 10 placed right of 20
    expect(checkPart(BUILD, wrong)).toEqual({ correct: false, onTrack: false, firstWrong: 3 });
  });

  it('stays on track while every key so far is right', () => {
    expect(checkPart(BUILD, right.slice(0, 2))).toEqual({ correct: false, onTrack: true, firstWrong: 2 });
  });

  it('rejects something that is not a list of spots', () => {
    expect(() => checkPart(BUILD, [40])).toThrow(TypeError);
    expect(() => checkPart(BUILD, 40)).toThrow(TypeError);
    expect(() => checkPart(BUILD, [{ parent: 40 }] as unknown as PartResponse)).toThrow(TypeError);
  });
});

describe('checkPart results', () => {
  it('are frozen', () => {
    const result = checkPart(LEAVES, [20, 30]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.missing)).toBe(true);
  });

  it('reject an unknown part type', () => {
    expect(() => checkPart({ type: 'guess' } as unknown as Part, 1)).toThrow(TypeError);
  });
});

describe('checkQuestion', () => {
  // Lesson 2, item 1 with retake 1: 57, 37, 27; found.
  const item: ItemSpec = {
    id: 'check-search-20',
    outcome: 'LO3',
    tree: 'T',
    ask: { kind: 'searchPath', key: 20 },
    prompt: 'Search for {20}.',
    hints: [],
    explanation: 'Found.',
  };
  const question = resolveItem(item, 2, 1);

  it('is correct when every part is', () => {
    expect(checkQuestion(question, [[57, 37, 27], 0])).toEqual({
      correct: true,
      parts: [{ correct: true, onTrack: true }, { correct: true }],
    });
  });

  it('is wrong when any part is wrong, and still reports each part', () => {
    // Right path, wrong result.
    expect(checkQuestion(question, [[57, 37, 27], 1])).toEqual({
      correct: false,
      parts: [{ correct: true, onTrack: true }, { correct: false }],
    });
  });

  it('marks the retake-0 path wrong on a retake', () => {
    expect(checkQuestion(question, [[50, 30, 20], 0]).correct).toBe(false);
  });

  it('needs one response per part', () => {
    expect(() => checkQuestion(question, [[57, 37, 27]])).toThrow(TypeError);
  });
});

describe('countsAsCorrect', () => {
  it('counts a correct answer with no hints, or with the first two rungs', () => {
    expect(countsAsCorrect(true, 0)).toBe(true);
    expect(countsAsCorrect(true, 1)).toBe(true);
    expect(countsAsCorrect(true, 2)).toBe(true);
  });

  it('does not count a correct answer after the worked solution was shown', () => {
    expect(countsAsCorrect(true, CONFIG.hintRungs)).toBe(false);
  });

  it('never counts a wrong answer', () => {
    expect(countsAsCorrect(false, 0)).toBe(false);
  });

  it('counts after the solution when the settings say so', () => {
    const lenient = validateConfig({ ...CONFIG, countCorrectAfterSolution: true });
    expect(countsAsCorrect(true, 3, lenient)).toBe(true);
  });

  it('follows the number of rungs in the settings', () => {
    const twoRungs = validateConfig({ ...CONFIG, hintRungs: 2 });
    expect(countsAsCorrect(true, 1, twoRungs)).toBe(true);
    expect(countsAsCorrect(true, 2, twoRungs)).toBe(false);
  });

  it('rejects a rung count that is negative, not whole, or more than the ladder has', () => {
    expect(() => countsAsCorrect(true, -1)).toThrow(RangeError);
    expect(() => countsAsCorrect(true, 1.5)).toThrow(RangeError);
    expect(() => countsAsCorrect(true, CONFIG.hintRungs + 1)).toThrow(RangeError);
  });
});