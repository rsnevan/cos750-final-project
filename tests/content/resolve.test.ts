import { describe, expect, it } from 'vitest';
import { CONFIG, getTree, offsetFor, resolveItem } from '../../src/content';
import type { ItemSpec, Part, PartSpec } from '../../src/content';
import { preorder, sameTree, searchSteps } from '../../src/engine';

const RETAKES = CONFIG.retakeOffsets.map((_, retake) => retake);

/** Lesson 2, item 1: search for 20 in T. Answer: 50, 30, 20; found. */
const SEARCH_20: ItemSpec = {
  id: 'test-search-20',
  outcome: 'LO3',
  tree: 'T',
  ask: { kind: 'searchPath', key: 20 },
  prompt: 'Click the nodes visited when searching for {20}, in order. Then give the result.',
  hints: [
    { text: 'At each node, ask: is {20} smaller or larger than this node?' },
    { text: 'The half of the tree that cannot hold {20} is now dimmed.', highlight: 'otherHalf' },
  ],
  explanation: 'The search visits {path} and finds {key}.',
  misconception: 'Search checks every node.',
};

/** Lesson 2, item 2: search for 65 in T, predicted from written options. Answer: 50, 70, 60; not found. */
const SEARCH_65: ItemSpec = {
  id: 'test-search-65',
  outcome: 'LO3',
  tree: 'T',
  ask: { kind: 'searchPath', key: 65 },
  intro: 'Predict first, then check.',
  prompt: 'Searching for {65} in this tree: which nodes are visited, and what is the result?',
  parts: [
    {
      type: 'pick',
      options: [
        '{path}, then an empty spot: not found',
        '{50}, {70}, {80}, then an empty spot: not found',
        '{path}, {65}: found',
        '{50}, {30}, {40}, then an empty spot: not found',
      ],
      answer: 0,
      shuffle: true,
    },
  ],
  hints: [
    { text: 'Is {65} smaller or larger than {50}? Then than {70}?' },
    { text: 'The half that cannot hold {65} is dimmed.', highlight: 'otherHalf' },
  ],
  explanation: 'The search visits {path}, then reaches the empty {side} side of {endAt}: not found.',
};

/** Lesson 2, item 3: searching for 45, which node's empty side ends the search? Answer: the right side of 40. */
const SEARCH_END_45: ItemSpec = {
  id: 'test-search-end-45',
  outcome: 'LO3',
  tree: 'T',
  ask: { kind: 'searchEnd', key: 45 },
  prompt: "Searching for {45}: which node's empty side ends the search?",
  hints: [
    { text: 'Is {45} smaller or larger than {50}? Keep comparing until the spot you need is empty.' },
    { text: 'The search path is highlighted.', highlight: 'path' },
  ],
  explanation: '{path}, then the {side} side of {endAt} is empty, so the search stops there.',
};

/** Lesson 2, item 4: the most nodes a search can visit in T. Answer: 3. */
const MAX_VISITS: ItemSpec = {
  id: 'test-max-visits',
  outcome: 'LO3',
  tree: 'T',
  ask: { kind: 'maxVisits' },
  prompt: 'What is the most nodes a search can visit in this tree?',
  hints: [
    { text: 'Each comparison moves you one level down. How many levels are there?' },
    { text: 'The longest root-to-leaf path is highlighted.', highlight: 'longestPath' },
  ],
  explanation: 'At most height + 1 = {most} nodes, one per level.',
};

/** Lesson 2, item 5: what does a search return at an empty spot? Answer: not found. */
const EMPTY_SPOT: ItemSpec = {
  id: 'test-empty-spot',
  outcome: 'LO3',
  tree: 'T',
  ask: { kind: 'fixed' },
  prompt: 'What does a search return when it reaches an empty spot?',
  parts: [
    { type: 'pick', options: ['The last node it visited', 'Not found', 'The root', 'The nearest key'], answer: 1 },
  ],
  hints: [
    { text: 'If the key were in the tree, where would it have to be?' },
    {
      text: 'An empty spot is shown on the tree. Could the key be anywhere else?',
      highlight: { slot: { parent: 40, side: 'right' } },
    },
  ],
  explanation: 'Not found. If the key were in the tree, it would have to be in that empty spot.',
};

type PickSpec = Extract<PartSpec, { type: 'pick' }>;

/** An item with some fields replaced. */
function variant(item: ItemSpec, changes: Partial<ItemSpec>): ItemSpec {
  return { ...item, ...changes };
}

/** The item's parts with a different answer part list. */
function withParts(item: ItemSpec, parts: PartSpec[]): ItemSpec {
  return variant(item, { parts });
}

/** The answer of a pick part, as the option text, so tests don't depend on the shuffle. */
function pickedText(part: Part | undefined): string {
  if (part?.type !== 'pick') throw new Error('expected a pick part');
  return part.options[part.answer] as string;
}

describe('resolveItem: what every question carries', () => {
  it('copies the item details and the lesson, with retake 0 by default', () => {
    const question = resolveItem(SEARCH_20, 2);
    expect(question.id).toBe('test-search-20');
    expect(question.lesson).toBe(2);
    expect(question.outcome).toBe('LO3');
    expect(question.retake).toBe(0);
  });

  it("uses the named tree with the retake's keys", () => {
    for (const retake of RETAKES) {
      expect(sameTree(resolveItem(SEARCH_20, 2, retake).tree, getTree('T', retake))).toBe(true);
    }
  });

  it('fills keys in every piece of text, shifted for the retake', () => {
    const question = resolveItem(SEARCH_20, 2, 1);
    expect(question.prompt).toBe('Click the nodes visited when searching for 27, in order. Then give the result.');
    expect(question.hints[0]?.text).toBe('At each node, ask: is 27 smaller or larger than this node?');
    expect(question.explanation).toBe('The search visits 57, 37, 27 and finds 27.');
    expect(question.misconception).toBe('Search checks every node.');
  });

  it('fills the intro, and leaves it out when the item has none', () => {
    expect(resolveItem(SEARCH_65, 2, 2).intro).toBe('Predict first, then check.');
    expect(resolveItem(SEARCH_20, 2)).not.toHaveProperty('intro');
    expect(resolveItem(MAX_VISITS, 2)).not.toHaveProperty('misconception');
  });

  it('is frozen, so a screen cannot change a question for the next student', () => {
    const question = resolveItem(SEARCH_65, 2);
    expect(Object.isFrozen(question)).toBe(true);
    expect(Object.isFrozen(question.parts)).toBe(true);
    expect(Object.isFrozen(question.parts[0])).toBe(true);
    expect(Object.isFrozen(question.hints[1]?.highlight)).toBe(true);
  });

  it('gives the same question every time for the same retake', () => {
    expect(resolveItem(SEARCH_65, 2, 3)).toEqual(resolveItem(SEARCH_65, 2, 3));
  });
});

describe('searchPath (Lesson 2, items 1 and 2)', () => {
  it('asks for the path in order, then found or not found', () => {
    const [path, result] = resolveItem(SEARCH_20, 2).parts;
    expect(path).toEqual({ type: 'click', label: 'Path', mode: 'path', answer: [50, 30, 20] });
    expect(result).toEqual({ type: 'pick', label: 'Result', options: ['Found', 'Not found'], answer: 0 });
  });

  it('answers "not found" for a key that is not in the tree', () => {
    const [path, result] = resolveItem(variant(SEARCH_20, { ask: { kind: 'searchPath', key: 65 } }), 2).parts;
    expect(path?.answer).toEqual([50, 70, 60]);
    expect(result?.answer).toBe(1);
  });

  it('shifts the answer for each retake', () => {
    expect(resolveItem(SEARCH_20, 2, 1).parts[0]?.answer).toEqual([57, 37, 27]);
    expect(resolveItem(SEARCH_20, 2, 2).parts[0]?.answer).toEqual([43, 23, 13]);
  });

  it('attaches the animated search as the worked solution', () => {
    for (const retake of RETAKES) {
      const key = 20 + offsetFor(retake);
      expect(resolveItem(SEARCH_20, 2, retake).solution).toEqual(searchSteps(getTree('T', retake), key));
    }
  });

  it('fills written options from the worked-out path, so the right option stays right on every retake', () => {
    expect(pickedText(resolveItem(SEARCH_65, 2).parts[0])).toBe('50, 70, 60, then an empty spot: not found');
    expect(pickedText(resolveItem(SEARCH_65, 2, 1).parts[0])).toBe('57, 77, 67, then an empty spot: not found');
  });

  it('shuffles options it is asked to, keeping every option and the answer', () => {
    const plain = resolveItem(variant(SEARCH_65, { parts: [{ ...(SEARCH_65.parts?.[0] as PickSpec), shuffle: false }] }), 2);
    const shuffled = resolveItem(SEARCH_65, 2);
    const [p, s] = [plain.parts[0], shuffled.parts[0]];
    if (p?.type !== 'pick' || s?.type !== 'pick') throw new Error('expected pick parts');
    expect([...s.options].sort()).toEqual([...p.options].sort());
    expect(pickedText(s)).toBe(pickedText(p));
  });

  it('does not always leave the right option first when shuffling', () => {
    const answers = RETAKES.map((retake) => resolveItem(SEARCH_65, 2, retake).parts[0]?.answer);
    expect(new Set(answers).size).toBeGreaterThan(1);
  });

  it('gives the end of an unsuccessful search to the text', () => {
    expect(resolveItem(SEARCH_65, 2).explanation).toBe(
      'The search visits 50, 70, 60, then reaches the empty right side of 60: not found.',
    );
  });

  it('rejects text that uses where the search ended when the key is found, naming the value', () => {
    expect(() => resolveItem(variant(SEARCH_20, { explanation: 'It stops at {endAt}.' }), 2)).toThrow(/endAt/);
  });
});

describe('searchEnd (Lesson 2, item 3)', () => {
  it('asks for the node, then the empty side', () => {
    const [node, side] = resolveItem(SEARCH_END_45, 2).parts;
    expect(node).toEqual({ type: 'click', label: 'The node', mode: 'one', answer: 40 });
    expect(side).toEqual({ type: 'pick', label: 'Which side of it is empty?', options: ['Left', 'Right'], answer: 1 });
  });

  it('answers "left" when the search stops on the left', () => {
    const [node, side] = resolveItem(variant(SEARCH_END_45, { ask: { kind: 'searchEnd', key: 55 } }), 2).parts;
    expect(node?.answer).toBe(60);
    expect(side?.answer).toBe(0);
  });

  it('shifts the node for each retake', () => {
    expect(resolveItem(SEARCH_END_45, 2, 3).parts[0]?.answer).toBe(53);
    expect(resolveItem(SEARCH_END_45, 2, 3).explanation).toBe(
      '63, 43, 53, then the right side of 53 is empty, so the search stops there.',
    );
  });

  it('rejects a key that is in the tree, since that search never reaches an empty spot', () => {
    expect(() => resolveItem(variant(SEARCH_END_45, { ask: { kind: 'searchEnd', key: 40 } }), 2)).toThrow(
      /test-search-end-45/,
    );
  });
});

describe('maxVisits (Lesson 2, item 4)', () => {
  it('asks for height + 1, with height, height + 2 and every node as the wrong options', () => {
    // 2 is the height (counting edges), 7 is "a search checks every node".
    expect(resolveItem(MAX_VISITS, 2).parts).toEqual([
      { type: 'pick', label: '', options: ['2', '3', '4', '7'], answer: 1 },
    ]);
  });

  it('gives a taller tree a larger answer', () => {
    const [part] = resolveItem(variant(MAX_VISITS, { tree: 'U' }), 2).parts;
    expect(pickedText(part)).toBe('4');
    expect(resolveItem(variant(MAX_VISITS, { tree: 'U' }), 2).explanation).toBe(
      'At most height + 1 = 4 nodes, one per level.',
    );
  });

  it('has no animation, so rung 3 shows the explanation', () => {
    expect(resolveItem(MAX_VISITS, 2).solution).toEqual([]);
  });
});

describe('fixed (Lesson 2, item 5)', () => {
  it('uses the written parts and answer', () => {
    expect(resolveItem(EMPTY_SPOT, 2).parts).toEqual([
      { type: 'pick', label: '', options: ['The last node it visited', 'Not found', 'The root', 'The nearest key'], answer: 1 },
    ]);
  });

  it('needs written parts', () => {
    expect(() => resolveItem(variant(EMPTY_SPOT, { parts: undefined }), 2)).toThrow(/test-empty-spot/);
  });

  it('shifts written click answers like any other key', () => {
    const item = withParts(EMPTY_SPOT, [
      { type: 'click', label: 'The node', mode: 'one', answer: 40 },
      { type: 'click', label: 'The path', mode: 'path', answer: [50, 30, 40] },
    ]);
    expect(resolveItem(item, 2, 1).parts.map((part) => part.answer)).toEqual([47, [57, 37, 47]]);
  });
});

describe('written parts', () => {
  it('can take a click answer from a worked-out value by name', () => {
    const item = withParts(SEARCH_END_45, [
      { type: 'click', label: 'Where does it stop?', mode: 'one', answer: 'endAt' },
      { type: 'click', label: 'Path', mode: 'set', answer: 'path' },
    ]);
    expect(resolveItem(item, 2, 1).parts.map((part) => part.answer)).toEqual([47, [57, 37, 47]]);
  });

  it('rejects a value name the task does not work out, naming it', () => {
    const item = withParts(SEARCH_END_45, [{ type: 'click', mode: 'one', answer: 'successor' }]);
    expect(() => resolveItem(item, 2)).toThrow(/successor/);
  });

  it('rejects a value of the wrong kind: a list for one node, or one node for a path', () => {
    expect(() => resolveItem(withParts(SEARCH_END_45, [{ type: 'click', mode: 'one', answer: 'path' }]), 2)).toThrow(
      /path/,
    );
    expect(() => resolveItem(withParts(SEARCH_END_45, [{ type: 'click', mode: 'path', answer: 'endAt' }]), 2)).toThrow(
      /endAt/,
    );
  });

  it('rejects a pick answer that is not one of the options', () => {
    expect(() => resolveItem(withParts(EMPTY_SPOT, [{ type: 'pick', options: ['A', 'B'], answer: 2 }]), 2)).toThrow(
      /test-empty-spot/,
    );
  });

  it('rejects a click answer key that is not in the tree', () => {
    expect(() => resolveItem(withParts(EMPTY_SPOT, [{ type: 'click', mode: 'one', answer: 45 }]), 2)).toThrow(/45/);
  });

  it('needs one to three parts', () => {
    expect(() => resolveItem(withParts(EMPTY_SPOT, []), 2)).toThrow(/test-empty-spot/);
    const pick: PartSpec = { type: 'pick', options: ['A', 'B'], answer: 0 };
    expect(() => resolveItem(withParts(EMPTY_SPOT, [pick, pick, pick, pick]), 2)).toThrow(/test-empty-spot/);
  });
});

describe('rung-2 highlights', () => {
  it('otherHalf dims the side of the root that cannot hold the key', () => {
    expect(resolveItem(SEARCH_20, 2).hints[1]?.highlight).toEqual({ dimmed: [70, 60, 80] });
    expect(resolveItem(SEARCH_65, 2).hints[1]?.highlight).toEqual({ dimmed: [30, 20, 40] });
    expect(resolveItem(SEARCH_20, 2, 1).hints[1]?.highlight).toEqual({ dimmed: [77, 67, 87] });
  });

  it('path shows the nodes and edges the search visits', () => {
    expect(resolveItem(SEARCH_END_45, 2).hints[1]?.highlight).toEqual({
      visited: [50, 30, 40],
      edges: [
        [50, 30],
        [30, 40],
      ],
    });
  });

  it('emptySpot points at where an unsuccessful search stops', () => {
    const item = variant(SEARCH_END_45, { hints: [{ text: 'Here.', highlight: 'emptySpot' }] });
    expect(resolveItem(item, 2, 1).hints[0]?.highlight).toEqual({ slot: { parent: 47, side: 'right' } });
  });

  it('longestPath shows the edges of a longest path from the root', () => {
    expect(resolveItem(MAX_VISITS, 2).hints[1]?.highlight).toEqual({
      edges: [
        [50, 30],
        [30, 20],
      ],
    });
    // In U the only longest path is 35, 20, 25, 22: not the leftmost edge.
    expect(resolveItem(variant(MAX_VISITS, { tree: 'U' }), 2).hints[1]?.highlight).toEqual({
      edges: [
        [35, 20],
        [20, 25],
        [25, 22],
      ],
    });
  });

  it('rejects a preset that does not fit the item', () => {
    // No key to search for.
    expect(() => resolveItem(variant(MAX_VISITS, { hints: [{ text: 'x', highlight: 'path' }] }), 2)).toThrow(/path/);
    // The key is the root, so no half is ruled out.
    const atRoot = variant(SEARCH_20, { ask: { kind: 'searchPath', key: 50 } });
    expect(() => resolveItem(atRoot, 2)).toThrow(/otherHalf/);
    // The key is found, so there is no empty spot.
    expect(() => resolveItem(variant(SEARCH_20, { hints: [{ text: 'x', highlight: 'emptySpot' }] }), 2)).toThrow(
      /emptySpot/,
    );
  });

  it('shifts every key in a written highlight', () => {
    expect(resolveItem(EMPTY_SPOT, 2, 1).hints[1]?.highlight).toEqual({ slot: { parent: 47, side: 'right' } });
    const written = variant(EMPTY_SPOT, {
      hints: [
        {
          text: 'x',
          highlight: {
            visited: [50, 30],
            current: 30,
            found: 40,
            offender: 20,
            outlined: [60],
            dimmed: [70, 80],
            edges: [[50, 30]],
            tags: { 50: 'root' },
            marker: { key: 30, position: 'in' },
            output: [20, 30],
            dots: 'pre',
          },
        },
      ],
    });
    expect(resolveItem(written, 2, 1).hints[0]?.highlight).toEqual({
      visited: [57, 37],
      current: 37,
      found: 47,
      offender: 27,
      outlined: [67],
      dimmed: [77, 87],
      edges: [[57, 37]],
      tags: { 57: 'root' },
      marker: { key: 37, position: 'in' },
      output: [27, 37],
      dots: 'pre',
    });
  });

  it('leaves out the highlight when a hint has none', () => {
    expect(resolveItem(SEARCH_20, 2).hints[0]).toEqual({
      text: 'At each node, ask: is 20 smaller or larger than this node?',
    });
  });
});

describe('mistakes in an item', () => {
  it('rejects an unknown tree, naming the item', () => {
    expect(() => resolveItem(variant(SEARCH_20, { tree: 'Q' }), 2)).toThrow(/test-search-20.*Q|Q.*test-search-20/);
  });

  it('rejects an unknown kind of task', () => {
    const item = { ...SEARCH_20, ask: { kind: 'guess' } } as unknown as ItemSpec;
    expect(() => resolveItem(item, 2)).toThrow(/guess/);
  });

  it('rejects a key that leaves 1 to 99 on some retake', () => {
    const item = variant(SEARCH_20, { ask: { kind: 'searchPath', key: 95 } });
    expect(() => resolveItem(item, 2, 0)).not.toThrow();
    expect(() => resolveItem(item, 2, 3)).toThrow(/test-search-20/); // 95 + 13 = 108
  });

  it('rejects a key that is not a whole number', () => {
    expect(() => resolveItem(variant(SEARCH_20, { ask: { kind: 'searchPath', key: 2.5 } }), 2)).toThrow(
      /test-search-20/,
    );
  });

  it('rejects a bad retake number', () => {
    expect(() => resolveItem(SEARCH_20, 2, -1)).toThrow(RangeError);
  });
});

describe('every retake asks the same question with new keys', () => {
  const ITEMS = [SEARCH_20, SEARCH_65, SEARCH_END_45, MAX_VISITS, EMPTY_SPOT];

  /**
   * An answer shifted back to retake 0, so answers can be compared across retakes.
   * In option text, only numbers that are keys in the tree are shifted back, not counts like "3".
   */
  function unshift(part: Part, offset: number, keys: readonly number[]): unknown {
    if (part.type === 'pick') {
      return part.options[part.answer]?.replace(/\d+/g, (n) =>
        keys.includes(Number(n)) ? String(Number(n) - offset) : n,
      );
    }
    if (part.type !== 'click') throw new Error('Lesson 2 has only pick and click parts');
    if (typeof part.answer === 'number') return part.answer - offset;
    return part.answer.map((key) => key - offset);
  }

  it.each(ITEMS.map((item) => [item.id, item] as const))('%s', (_, item) => {
    const answers = (retake: number) => {
      const question = resolveItem(item, 2, retake);
      const keys = preorder(question.tree);
      return question.parts.map((part) => unshift(part, offsetFor(retake), keys));
    };
    const original = answers(0);
    for (const retake of RETAKES) {
      expect(answers(retake)).toEqual(original);
    }
  });
});