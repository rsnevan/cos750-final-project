/**
 * The task kinds for Lessons 1, 3, 4 and 5 (Lesson 2's are in resolve.test.ts).
 * Expected answers are from the lesson plan's activity tables and the final
 * test table (tree U, and trees V and W).
 */
import { describe, expect, it } from 'vitest';
import { CONFIG, getTree, offsetFor, resolveItem } from '../../src/content';
import type { AskSpec, ItemSpec, LessonId, Part, Question } from '../../src/content';
import {
  buildSteps,
  deleteSteps,
  extremeSteps,
  insertSteps,
  preorder,
  remove,
  sameTree,
  subtree,
  toShape,
  traversalSteps,
} from '../../src/engine';

const RETAKES = CONFIG.retakeOffsets.map((_, retake) => retake);

/** An item with placeholder wording, so each test only states what it checks. */
function item(ask: AskSpec, extra: Partial<ItemSpec> = {}): ItemSpec {
  return { id: `kind-${ask.kind}`, outcome: 'LO1', tree: 'T', ask, prompt: 'p', hints: [], explanation: 'e', ...extra };
}

function resolve(spec: ItemSpec, retake = 0, lesson: LessonId = 1): Question {
  return resolveItem(spec, lesson, retake);
}

function answers(question: Question): unknown[] {
  return question.parts.map((part) => part.answer);
}

/** The text of a pick part's right option, which doesn't depend on the shuffle. */
function picked(part: Part | undefined): string {
  if (part?.type !== 'pick') throw new Error('expected a pick part');
  return part.options[part.answer] as string;
}

// ---------------------------------------------------------------- Lesson 1

describe('rootAndLeaves (Lesson 1, item 1; final test, item 1)', () => {
  it('asks for the root and every leaf of T in one click set', () => {
    expect(resolve(item({ kind: 'rootAndLeaves' })).parts).toEqual([
      { type: 'click', label: '', mode: 'set', answer: [50, 20, 40, 60, 80] },
    ]);
  });

  it('can also ask for the height: U has root 35, leaves 10, 22, 45, 60 and height 3', () => {
    const question = resolve(item({ kind: 'rootAndLeaves', withHeight: true }, { tree: 'U' }));
    expect(question.parts[0]?.answer).toEqual([35, 10, 22, 45, 60]);
    expect(question.parts[1]).toMatchObject({ type: 'pick', label: 'Height of the tree' });
    expect(picked(question.parts[1])).toBe('3');
  });

  it('works out the root and leaves for the text', () => {
    const question = resolve(item({ kind: 'rootAndLeaves' }, { explanation: 'Root {root}; leaves {leaves}.' }), 1);
    expect(question.explanation).toBe('Root 57; leaves 27, 47, 67, 87.');
  });

  it('shows the root, then the leaves, as the worked solution', () => {
    const solution = resolve(item({ kind: 'rootAndLeaves' })).solution;
    expect(solution.map((step) => step.highlight.tags)).toEqual([
      { 50: 'root' },
      { 50: 'root', 20: 'leaf', 40: 'leaf', 60: 'leaf', 80: 'leaf' },
    ]);
    expect(solution[0]?.text).toBe('50 has no parent: it is the root.');
    expect(solution[1]?.text).toBe('20, 40, 60 and 80 have no children: they are leaves.');
  });

  it('outlines every leaf with the leaves preset', () => {
    const question = resolve(item({ kind: 'rootAndLeaves' }, { hints: [{ text: 'h', highlight: 'leaves' }] }));
    expect(question.hints[0]?.highlight).toEqual({ outlined: [20, 40, 60, 80] });
  });
});

describe('depthHeight (Lesson 1, item 2)', () => {
  const spec = item({ kind: 'depthHeight', depthOf: 40, heightOf: 30 });

  it('asks for the depth of 40 (2) and the height of the subtree rooted at 30 (1)', () => {
    expect(resolve(spec).parts).toEqual([
      { type: 'pick', label: 'Depth of 40', options: ['0', '1', '2', '3'], answer: 2 },
      { type: 'pick', label: 'Height of the subtree rooted at 30', options: ['0', '1', '2', '3'], answer: 1 },
    ]);
  });

  it('shifts the keys in the labels, but not the depth and height', () => {
    const [depth, height] = resolve(spec, 3).parts;
    expect(depth?.label).toBe('Depth of 53');
    expect(height?.label).toBe('Height of the subtree rooted at 43');
    expect([picked(depth), picked(height)]).toEqual(['2', '1']);
  });

  it('can ask for one measure only, and calls the subtree at the root "the tree"', () => {
    const question = resolve(item({ kind: 'depthHeight', heightOf: 35 }, { tree: 'U' }));
    expect(question.parts).toEqual([
      { type: 'pick', label: 'Height of the tree', options: ['0', '1', '2', '3', '4'], answer: 3 },
    ]);
  });

  it('needs at least one of the two, and keys that are in the tree', () => {
    expect(() => resolve(item({ kind: 'depthHeight' }))).toThrow(/kind-depthHeight/);
    expect(() => resolve(item({ kind: 'depthHeight', depthOf: 45 }))).toThrow(/45/);
  });

  it('highlights the edges down to 40 and outlines the subtree rooted at 30', () => {
    const question = resolve({ ...spec, hints: [{ text: 'h', highlight: 'depthHeight' }] });
    expect(question.hints[0]?.highlight).toEqual({
      edges: [
        [50, 30],
        [30, 40],
      ],
      outlined: [30, 20, 40],
    });
  });

  it('works out the depth and height for the text, with one solution step for each', () => {
    const question = resolve({ ...spec, explanation: 'Depth {depth}; height {height}.' });
    expect(question.explanation).toBe('Depth 2; height 1.');
    expect(question.solution.map((step) => step.text)).toEqual([
      'From the root to 40: 2 edges, so the depth is 2.',
      'From 30 down to a leaf: 1 edge at most, so the height is 1.',
    ]);
  });
});

describe('validity (Lesson 1, items 3 to 5; final test, items 2 and 3)', () => {
  it('T is valid: only "valid or invalid" is asked', () => {
    expect(resolve(item({ kind: 'validity' })).parts).toEqual([
      { type: 'pick', label: '', options: ['Valid', 'Invalid'], answer: 0 },
    ]);
  });

  it('X is invalid, and 40 breaks the rule', () => {
    expect(resolve(item({ kind: 'validity' }, { tree: 'X' })).parts).toEqual([
      { type: 'pick', label: '', options: ['Valid', 'Invalid'], answer: 1 },
      { type: 'click', label: 'The node that breaks the rule', mode: 'one', answer: 40 },
    ]);
  });

  it('the 55 tree is invalid at 55, V at 35, and W is valid', () => {
    expect(answers(resolve(item({ kind: 'validity' }, { tree: 'T55' })))).toEqual([1, 55]);
    expect(answers(resolve(item({ kind: 'validity' }, { tree: 'V' })))).toEqual([1, 35]);
    expect(answers(resolve(item({ kind: 'validity' }, { tree: 'W' })))).toEqual([0]);
  });

  it('marks the offender on the tree shown after answering', () => {
    const question = resolve(item({ kind: 'validity' }, { tree: 'X' }), 1);
    expect(question.result?.highlight).toEqual({ offender: 47 });
    expect(sameTree(question.result?.tree ?? null, getTree('X', 1))).toBe(true);
  });

  it('works out the offender for the text', () => {
    const question = resolve(item({ kind: 'validity' }, { tree: 'X', explanation: '{offender} is {valid}.' }));
    expect(question.explanation).toBe('40 is invalid.');
  });
});

// ---------------------------------------------------------------- Lesson 3

describe('insertSlot (Lesson 3, items 1 and 2; final test, item 5)', () => {
  it('10 goes left of 20, and 55 left of 60, in T', () => {
    expect(resolve(item({ kind: 'insertSlot', key: 10 })).parts).toEqual([
      { type: 'place', label: '', keys: [10], answer: [{ parent: 20, side: 'left' }] },
    ]);
    expect(answers(resolve(item({ kind: 'insertSlot', key: 55 })))).toEqual([[{ parent: 60, side: 'left' }]]);
  });

  it('55 goes left of 60 in U', () => {
    expect(answers(resolve(item({ kind: 'insertSlot', key: 55 }, { tree: 'U' })))).toEqual([
      [{ parent: 60, side: 'left' }],
    ]);
  });

  it('shifts the key and the spot for a retake', () => {
    expect(resolve(item({ kind: 'insertSlot', key: 10 }), 1).parts[0]).toEqual({
      type: 'place',
      label: '',
      keys: [17],
      answer: [{ parent: 27, side: 'left' }],
    });
  });

  it('animates the insert, and shows the new tree after answering', () => {
    const question = resolve(item({ kind: 'insertSlot', key: 10 }));
    expect(question.solution).toEqual(insertSteps(getTree('T'), 10));
    expect(toShape(question.result?.tree ?? null)).toEqual([50, [30, [20, [10]], [40]], [70, [60], [80]]]);
    expect(question.result?.highlight).toEqual({
      found: 10,
      edges: [
        [50, 30],
        [30, 20],
        [20, 10],
      ],
    });
  });

  it('rejects a key that is already in the tree, since nothing would be placed', () => {
    expect(() => resolve(item({ kind: 'insertSlot', key: 50 }))).toThrow(/kind-insertSlot/);
  });
});

describe('build (Lesson 3, item 4)', () => {
  const spec = item({ kind: 'build', keys: [40, 20, 60, 10] }, { tree: undefined });

  it('starts from an empty tree and places 40, 20, 60, 10 one at a time', () => {
    const question = resolve(spec);
    expect(question.tree).toBeNull();
    expect(question.parts).toEqual([
      {
        type: 'place',
        label: '',
        keys: [40, 20, 60, 10],
        answer: [
          { parent: null, side: null },
          { parent: 40, side: 'left' },
          { parent: 40, side: 'right' },
          { parent: 20, side: 'left' },
        ],
      },
    ]);
  });

  it('gives root 40, left child 20 with left child 10, and right child 60', () => {
    expect(toShape(resolve(spec).result?.tree ?? null)).toEqual([40, [20, [10]], [60]]);
  });

  it('animates the build, with the keys shifted on a retake', () => {
    expect(resolve(spec, 1).parts[0]).toMatchObject({ keys: [47, 27, 67, 17] });
    expect(resolve(spec, 1).solution).toEqual(buildSteps([47, 27, 67, 17]));
  });

  it('can grow an existing tree instead', () => {
    const question = resolve(item({ kind: 'build', keys: [45, 65] }));
    expect(answers(question)).toEqual([
      [
        { parent: 40, side: 'right' },
        { parent: 60, side: 'right' },
      ],
    ]);
  });

  it('rejects a repeated key or a key already in the tree', () => {
    expect(() => resolve(item({ kind: 'build', keys: [40, 20, 40] }, { tree: undefined }))).toThrow(/kind-build/);
    expect(() => resolve(item({ kind: 'build', keys: [45, 50] }))).toThrow(/kind-build/);
  });
});

describe('minMax (Lesson 3, items 5 and 6; final test, item 6)', () => {
  it('T has minimum 20 and maximum 80', () => {
    expect(resolve(item({ kind: 'minMax', find: ['min', 'max'] })).parts).toEqual([
      { type: 'click', label: 'Minimum', mode: 'one', answer: 20 },
      { type: 'click', label: 'Maximum', mode: 'one', answer: 80 },
    ]);
  });

  it('U has minimum 10 and maximum 60', () => {
    expect(answers(resolve(item({ kind: 'minMax', find: ['min', 'max'] }, { tree: 'U' })))).toEqual([10, 60]);
  });

  it('the smallest key in the subtree rooted at 70 is 60, with the rest of the tree dimmed', () => {
    const question = resolve(item({ kind: 'minMax', find: ['min'], from: 70 }));
    expect(question.parts).toEqual([
      { type: 'click', label: 'Minimum of the subtree rooted at 70', mode: 'one', answer: 60 },
    ]);
    expect(question.base).toEqual({ dimmed: [50, 30, 20, 40] });
    expect(question.solution).toEqual(extremeSteps(subtree(getTree('T'), 70), 'min'));
  });

  it('animates the minimum, then the maximum', () => {
    const t = getTree('T');
    expect(resolve(item({ kind: 'minMax', find: ['min', 'max'] })).solution).toEqual([
      ...extremeSteps(t, 'min'),
      ...extremeSteps(t, 'max'),
    ]);
  });

  it('highlights the paths going left and right with the extremePaths preset', () => {
    const both = resolve(item({ kind: 'minMax', find: ['min', 'max'] }, { hints: [{ text: 'h', highlight: 'extremePaths' }] }));
    expect(both.hints[0]?.highlight).toEqual({
      edges: [
        [50, 30],
        [30, 20],
        [50, 70],
        [70, 80],
      ],
    });
    const sub = resolve(item({ kind: 'minMax', find: ['min'], from: 70 }, { hints: [{ text: 'h', highlight: 'extremePaths' }] }));
    expect(sub.hints[0]?.highlight).toEqual({ edges: [[70, 60]] });
  });

  it('rejects an empty or repeated list of things to find', () => {
    expect(() => resolve(item({ kind: 'minMax', find: [] }))).toThrow(/kind-minMax/);
    expect(() => resolve(item({ kind: 'minMax', find: ['min', 'min'] }))).toThrow(/kind-minMax/);
  });
});

// ---------------------------------------------------------------- Lesson 4

describe('traversal (Lesson 4, items 1 to 5; final test, items 7 and 8)', () => {
  const order = (spec: ItemSpec, retake = 0) => {
    const part = resolve(spec, retake).parts[0];
    if (part?.type !== 'order') throw new Error('expected an order part');
    return part;
  };

  it('gives the lesson plan sequences for T', () => {
    expect(order(item({ kind: 'traversal', order: 'in' })).answer).toEqual([20, 30, 40, 50, 60, 70, 80]);
    expect(order(item({ kind: 'traversal', order: 'pre' })).answer).toEqual([50, 30, 20, 40, 70, 60, 80]);
    expect(order(item({ kind: 'traversal', order: 'post' })).answer).toEqual([20, 40, 30, 60, 80, 70, 50]);
  });

  it('gives pre-order 70 60 80 for the subtree rooted at 70, with the rest dimmed', () => {
    const spec = item({ kind: 'traversal', order: 'pre', from: 70 });
    expect(order(spec).answer).toEqual([70, 60, 80]);
    expect(resolve(spec).base).toEqual({ dimmed: [50, 30, 20, 40] });
  });

  it('gives post-order 20 45 40 30 60 80 70 50 for T2', () => {
    expect(order(item({ kind: 'traversal', order: 'post' }, { tree: 'T2' })).answer).toEqual([
      20, 45, 40, 30, 60, 80, 70, 50,
    ]);
  });

  it('gives in-order and post-order for U', () => {
    expect(order(item({ kind: 'traversal', order: 'in' }, { tree: 'U' })).answer).toEqual([
      10, 20, 22, 25, 35, 45, 50, 60,
    ]);
    expect(order(item({ kind: 'traversal', order: 'post' }, { tree: 'U' })).answer).toEqual([
      10, 22, 25, 20, 45, 60, 50, 35,
    ]);
  });

  it('deals the cards out of order, but always the same way for the same retake', () => {
    for (const kind of ['pre', 'in', 'post'] as const) {
      for (const retake of RETAKES) {
        const part = order(item({ kind: 'traversal', order: kind }), retake);
        expect([...part.cards].sort((a, b) => a - b)).toEqual([...part.answer].sort((a, b) => a - b));
        expect(part.cards).not.toEqual(part.answer);
        expect(order(item({ kind: 'traversal', order: kind }), retake).cards).toEqual(part.cards);
      }
    }
  });

  it('animates the traversal, and shows the dots with the dots preset', () => {
    const spec = item({ kind: 'traversal', order: 'post' }, { hints: [{ text: 'h', highlight: 'dots' }] });
    expect(resolve(spec).solution).toEqual(traversalSteps(getTree('T'), 'post'));
    expect(resolve(spec).hints[0]?.highlight).toEqual({ dots: 'post' });
  });

  it('names the order and gives the sequence for the text', () => {
    const spec = item({ kind: 'traversal', order: 'pre' }, { explanation: '{orderName}: {sequence}.' });
    expect(resolve(spec).explanation).toBe('pre-order: 50, 30, 20, 40, 70, 60, 80.');
  });
});

// ---------------------------------------------------------------- Lesson 5

/** A delete item whose first written result is the right one. */
function del(key: number, right: string, extra: Partial<AskSpec & { kind: 'delete' }> = {}, tree = 'T'): ItemSpec {
  return item(
    { kind: 'delete', key, result: { options: [right, 'wrong one', 'wrong two', 'wrong three'], answer: 0 }, ...extra },
    { tree },
  );
}

describe('delete (Lesson 5, items 1 to 4; final test, items 9 and 10)', () => {
  it('60 in T is a leaf; 70 keeps only its right child 80', () => {
    const question = resolve(del(60, '{70} keeps only its right child {80}'), 0, 5);
    expect(question.parts[0]).toEqual({
      type: 'pick',
      label: 'Which case is this?',
      options: ['Leaf', 'One child', 'Two children'],
      answer: 0,
    });
    expect(picked(question.parts[1])).toBe('70 keeps only its right child 80');
    expect(question.parts[1]?.label).toBe('What does the tree look like afterwards?');
    expect(question.deleteCase).toBe('leaf');
    expect(toShape(question.result?.tree ?? null)).toEqual([50, [30, [20], [40]], [70, null, [80]]]);
  });

  it('40 in T2 has one child; 45 takes its place', () => {
    const question = resolve(del(40, 'x', {}, 'T2'), 0, 5);
    expect(question.parts[0]?.answer).toBe(1);
    expect(question.deleteCase).toBe('one');
    expect(toShape(question.result?.tree ?? null)).toEqual([50, [30, [20], [45]], [70, [60], [80]]]);
    expect(question.result?.highlight).toEqual({ found: 45 });
  });

  it('30 in T has two children; successor 40; the node becomes 40 with left child 20', () => {
    const question = resolve(del(30, 'x', { successor: true }), 0, 5);
    expect(question.parts.map((part) => part.type)).toEqual(['pick', 'click', 'pick']);
    expect(question.parts[0]?.answer).toBe(2);
    expect(question.parts[1]).toEqual({ type: 'click', label: 'Click the in-order successor', mode: 'one', answer: 40 });
    expect(question.deleteCase).toBe('two');
    expect(toShape(question.result?.tree ?? null)).toEqual([50, [40, [20]], [70, [60], [80]]]);
    expect(question.result?.highlight).toEqual({ found: 40 });
  });

  it('50 in T: successor 60; the root becomes 60 and 70 keeps only 80', () => {
    const question = resolve(del(50, 'x', { successor: true }), 0, 5);
    expect(question.parts[1]?.answer).toBe(60);
    expect(toShape(question.result?.tree ?? null)).toEqual([60, [30, [20], [40]], [70, null, [80]]]);
  });

  it('25 in U has one child, 22; 20 in U has successor 22', () => {
    const one = resolve(del(25, 'x', {}, 'U'), 0, 'final');
    expect(one.deleteCase).toBe('one');
    expect(toShape(one.result?.tree ?? null)).toEqual([35, [20, [10], [22]], [50, [45], [60]]]);
    const two = resolve(del(20, 'x', { successor: true }, 'U'), 0, 'final');
    expect(two.parts[1]?.answer).toBe(22);
    expect(toShape(two.result?.tree ?? null)).toEqual([35, [22, [10], [25]], [50, [45], [60]]]);
  });

  it('tags the node to delete, animates the delete, and shuffles the written results', () => {
    const question = resolve(del(30, 'x', { successor: true }), 2, 5);
    expect(question.base).toEqual({ tags: { 23: 'delete' } });
    expect(question.solution).toEqual(deleteSteps(getTree('T', 2), 23));
    const results = RETAKES.map((retake) => resolve(del(30, 'x'), retake, 5).parts[1]?.answer);
    expect(new Set(results).size).toBeGreaterThan(1);
  });

  it('works out the case, successor and child for the text', () => {
    const two = del(50, 'x', {});
    two.explanation = '{caseName}. Successor {successor}.';
    expect(resolve(two, 0, 5).explanation).toBe('Case 3, two children. Successor 60.');
    const one = del(40, 'x', {}, 'T2');
    one.explanation = '{caseName}: {child} moves up.';
    expect(resolve(one, 0, 5).explanation).toBe('Case 2, one child: 45 moves up.');
  });

  it('outlines the children, or the right subtree, with the presets', () => {
    const one = { ...del(40, 'x', {}, 'T2'), hints: [{ text: 'h', highlight: 'children' as const }] };
    expect(resolve(one, 0, 5).hints[0]?.highlight).toEqual({ outlined: [45] });
    const two = { ...del(30, 'x'), hints: [{ text: 'h', highlight: 'rightSubtree' as const }] };
    expect(resolve(two, 0, 5).hints[0]?.highlight).toEqual({ outlined: [40], dimmed: [50, 70, 60, 80] });
  });

  it('rejects asking for a successor when the node does not have two children', () => {
    expect(() => resolve(del(60, 'x', { successor: true }), 0, 5)).toThrow(/kind-delete/);
  });

  it('rejects a key that is not in the tree, or a result answer that is not an option', () => {
    expect(() => resolve(del(65, 'x'), 0, 5)).toThrow(/kind-delete/);
    const bad = item({ kind: 'delete', key: 60, result: { options: ['a', 'b'], answer: 2 } });
    expect(() => resolve(bad, 0, 5)).toThrow(/kind-delete/);
  });
});

describe('successor (Lesson 5, item 5)', () => {
  it('the in-order successor of 50 in T is 60', () => {
    const question = resolve(item({ kind: 'successor', key: 50 }), 0, 5);
    expect(question.parts).toEqual([{ type: 'click', label: 'The in-order successor', mode: 'one', answer: 60 }]);
    expect(question.solution).toEqual(extremeSteps(subtree(getTree('T'), 70), 'min'));
  });

  it('outlines the right subtree with the rightSubtree preset', () => {
    const spec = item({ kind: 'successor', key: 50 }, { hints: [{ text: 'h', highlight: 'rightSubtree' }] });
    expect(resolve(spec, 0, 5).hints[0]?.highlight).toEqual({ outlined: [70, 60, 80] });
  });

  it('rejects a key with no successor', () => {
    expect(() => resolve(item({ kind: 'successor', key: 80 }), 0, 5)).toThrow(/kind-successor/);
  });
});

// ---------------------------------------------------------------- shared

describe('tree references', () => {
  it('can show a tree after an insert: T with 45 is T2', () => {
    const question = resolve(item({ kind: 'fixed' }, { tree: { from: 'T', insert: [45] }, parts: [{ type: 'pick', options: ['a', 'b'], answer: 0 }] }));
    expect(sameTree(question.tree, getTree('T2'))).toBe(true);
  });

  it('can show a tree after a delete (Lesson 5, item 6: T after deleting the root)', () => {
    const spec = item({ kind: 'traversal', order: 'in' }, { tree: { from: 'T', delete: [50] } });
    for (const retake of RETAKES) {
      expect(sameTree(resolve(spec, retake, 5).tree, remove(getTree('T', retake), 50 + offsetFor(retake)).tree)).toBe(
        true,
      );
    }
    expect(resolve(spec, 0, 5).parts[0]?.answer).toEqual([20, 30, 40, 60, 70, 80]);
  });

  it('rejects a delete of a key that is not there, an insert of one that is, or an unknown tree', () => {
    expect(() => resolve(item({ kind: 'validity' }, { tree: { from: 'T', delete: [45] } }))).toThrow(/45/);
    expect(() => resolve(item({ kind: 'validity' }, { tree: { from: 'T', insert: [50] } }))).toThrow(/50/);
    expect(() => resolve(item({ kind: 'validity' }, { tree: { from: 'Q' } }))).toThrow(/Q/);
  });

  it('needs a tree for every kind except build', () => {
    expect(() => resolve(item({ kind: 'validity' }, { tree: undefined }))).toThrow(/kind-validity/);
  });
});

describe('base highlights, bridges and written highlights', () => {
  it('lets an item replace the task\'s base highlight', () => {
    const spec = item({ kind: 'minMax', find: ['min'], from: 70 }, { base: { outlined: [70] } });
    expect(resolve(spec, 1).base).toEqual({ outlined: [77] });
    const preset = item({ kind: 'delete', key: 30, result: { options: ['a', 'b'], answer: 0 } }, { base: 'rightSubtree' });
    expect(resolve(preset, 0, 5).base).toEqual({ outlined: [40], dimmed: [50, 70, 60, 80] });
  });

  it('fills the bridge line', () => {
    expect(resolve(item({ kind: 'successor', key: 50 }, { bridge: 'Remember {60}.' }), 1).bridge).toBe('Remember 67.');
  });

  it('fills keys in tag, slot and edge labels, and shifts the keys they sit on', () => {
    const spec = item(
      { kind: 'fixed' },
      {
        tree: 'T55',
        parts: [{ type: 'pick', options: ['a', 'b'], answer: 0 }],
        hints: [
          {
            text: 'h',
            highlight: {
              tags: { 55: 'allowed: {31} to {49}' },
              edgeLabels: [[50, 30, 'smaller than {50}']],
              slot: { parent: 70, side: 'left' },
              slotLabel: '{51} to {69}',
              dots: 'all',
            },
          },
        ],
      },
    );
    expect(resolve(spec, 1).hints[0]?.highlight).toEqual({
      tags: { 62: 'allowed: 38 to 56' },
      edgeLabels: [[57, 37, 'smaller than 57']],
      slot: { parent: 77, side: 'left' },
      slotLabel: '58 to 76',
      dots: 'all',
    });
  });
});

describe('every retake asks the same question with new keys', () => {
  const ITEMS: [string, ItemSpec, LessonId][] = [
    ['rootAndLeaves', item({ kind: 'rootAndLeaves', withHeight: true }, { tree: 'U' }), 'final'],
    ['depthHeight', item({ kind: 'depthHeight', depthOf: 40, heightOf: 30 }), 1],
    ['validity X', item({ kind: 'validity' }, { tree: 'X' }), 1],
    ['validity V', item({ kind: 'validity' }, { tree: 'V' }), 'final'],
    ['insertSlot', item({ kind: 'insertSlot', key: 55 }, { tree: 'U' }), 3],
    ['build', item({ kind: 'build', keys: [40, 20, 60, 10] }, { tree: undefined }), 3],
    ['minMax', item({ kind: 'minMax', find: ['min', 'max'], from: 30 }), 3],
    ['traversal', item({ kind: 'traversal', order: 'post' }, { tree: 'T2' }), 4],
    ['delete', del(20, '{20} is replaced by {22}', { successor: true }, 'U'), 'final'],
    ['successor', item({ kind: 'successor', key: 30 }), 5],
  ];

  /** Every answer with its keys shifted back to retake 0. */
  function unshifted(question: Question, offset: number): unknown[] {
    const keys = new Set([...preorder(question.tree), ...preorder(question.result?.tree ?? null)]);
    const back = (key: number) => key - offset;
    return question.parts.map((part) => {
      switch (part.type) {
        case 'pick':
          // Options that are all plain numbers are counts (a depth or height), not keys.
          if (part.options.every((option) => /^\d+$/.test(option))) return part.options[part.answer];
          return part.options[part.answer]?.replace(/\d+/g, (n) => (keys.has(Number(n)) ? String(back(Number(n))) : n));
        case 'click':
          return typeof part.answer === 'number' ? back(part.answer) : part.answer.map(back);
        case 'order':
          return part.answer.map(back);
        case 'place':
          return part.answer.map((slot) => ({ ...slot, parent: slot.parent === null ? null : back(slot.parent) }));
      }
    });
  }

  it.each(ITEMS)('%s', (_, spec, lesson) => {
    const original = unshifted(resolveItem(spec, lesson, 0), 0);
    for (const retake of RETAKES) {
      expect(unshifted(resolveItem(spec, lesson, retake), offsetFor(retake))).toEqual(original);
    }
  });
});