/**
 * The lesson file format: checking a file's structure (validateLesson) and
 * building its stages (resolveLesson). The fixture uses every kind of stage
 * once, with content from the wireframe, so the expected trees and answers
 * are the lesson plan's.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getTree, resolveLesson, validateLesson } from '../../src/content';
import type { Explore, LessonSpec } from '../../src/content';
import {
  PSEUDOCODE,
  deleteSteps,
  extremeSteps,
  sameTree,
  searchSteps,
  subtree,
  toShape,
  traversalSteps,
  walkSteps,
} from '../../src/engine';

/** A fresh copy of a small lesson using every kind of stage, so a test can change one thing. */
function mini(): Record<string, any> {
  return {
    lesson: 2,
    title: 'Search',
    short: 'Search',
    minutes: 12,
    outcomes: ['LO3'],
    summary: 'Trace a search.',
    hook: {
      goal: 'Trace a search.',
      scenario: { title: 'A guessing game', text: 'Higher or lower?', reveal: 'Guess 50 first.' },
      warmUp: {
        question: 'Where does a search for 45 stop?',
        tree: 'T',
        options: [
          { text: 'At 40', reply: 'It only stops at an empty spot.' },
          { text: 'Right of 40', reply: 'Yes.' },
        ],
        answer: 1,
      },
      bridge: 'Keep that in mind.',
    },
    explore: [
      { kind: 'relatives', tree: 'T', need: 3 },
      {
        kind: 'pickTree',
        prompt: 'Which tree lets a search always choose a side?',
        trees: [
          { label: 'A', tree: 'T' },
          { label: 'B', tree: 'X' },
        ],
        answer: 0,
        reveal: 'Tree A.',
      },
      { kind: 'freeSearch', tree: 'T', key: 60 },
      { kind: 'slotProbe', tree: 'T', key: 45 },
      { kind: 'walk', tree: 'T' },
      { kind: 'orderGuess', tree: 'T', order: 'pre' },
      {
        kind: 'deleteTry',
        cases: [
          {
            label: 'Remove 70 from T',
            tree: 'T',
            key: 70,
            options: [
              { text: 'Move 80 up and hang 60 under it', result: 'delete' },
              { text: 'Move 60 up and hang 80 under it', result: { shape: [50, [30, [20], [40]], [60, null, [80]]] } },
              { text: 'Leave the gap empty', result: null },
            ],
            note: 'That only works because 60 and 80 are leaves.',
          },
        ],
      },
      {
        kind: 'reflect',
        prompt: 'Which removal was hardest?',
        options: [
          { text: 'Removing 70', reply: 'Most students say so.' },
          { text: 'Removing 20', reply: 'A leaf is the easy case.' },
        ],
        answer: null,
      },
    ],
    explain: {
      pages: [
        {
          title: 'How search works',
          terms: [{ group: 'Shape words', items: [{ term: 'Node', meaning: 'one item in the tree' }] }],
          steps: ['Start at the root.', 'Smaller: go left.'],
          note: 'At most height + 1 nodes.',
          diagram: { tree: 'T', highlight: { edgeLabels: [[50, 30, 'smaller: left']], dots: 'all' } },
          caption: 'Each step throws away a subtree.',
          pseudocode: 'search',
        },
      ],
    },
    worked: {
      examples: [
        { label: 'Search for 60', pseudocode: 'search', steps: [{ search: { tree: 'T', key: 60 } }] },
        {
          label: 'Min and max',
          steps: [{ extreme: { tree: 'T', which: 'min' } }, { extreme: { tree: 'T', which: 'max' } }],
        },
        { label: 'Delete 70', deleteCase: 'two', pseudocode: 'delete', steps: [{ delete: { tree: 'T', key: 70 } }] },
        {
          label: 'Check tree X',
          steps: [{ tree: 'X', highlight: { offender: 40 }, text: '40 is smaller than 50 but sits on its right.' }],
        },
      ],
    },
    tryIt: { kind: 'search', title: 'Search for 80', tree: 'T', key: 80 },
    activity: {
      title: 'Find the path',
      items: [
        {
          id: 'mini-1',
          outcome: 'LO3',
          tree: 'T',
          ask: { kind: 'searchPath', key: 20 },
          prompt: 'Click the nodes visited when searching for {20}.',
          hints: [{ text: 'Smaller or larger?' }, { text: 'The other half is dimmed.', highlight: 'otherHalf' }],
          explanation: 'The search visits {path}.',
        },
      ],
    },
  };
}

/** The guided try-its from Lesson 1 (with the corrected empty spot) and Lesson 5. */
const LESSON1_TRY_IT = {
  kind: 'guided',
  title: 'Label tree T',
  tree: 'T',
  steps: [
    { ask: 'node', prompt: 'Click the root.', answer: 'root', tag: 'root', right: 'Yes.', wrong: 'No parent.' },
    { ask: 'node', prompt: 'Click any leaf.', answer: 'leaves', tag: 'leaf', right: 'Yes.', wrong: 'No children.' },
    { ask: 'node', prompt: 'Label the parent of 40.', answer: { parentOf: 40 }, tag: 'parent', right: 'Yes.', wrong: 'Above 40.' },
    {
      ask: 'choice',
      prompt: 'There is an empty spot on the right of 60. Which key could go there?',
      options: ['45', '65', '75'],
      answer: 1,
      highlight: { slot: { parent: 60, side: 'right' } },
      showRange: true,
      right: '65 fits.',
      wrong: 'Check every ancestor.',
    },
  ],
};

const LESSON5_TRY_IT = {
  kind: 'guided',
  title: 'Delete 70 from T',
  tree: 'T',
  steps: [
    { ask: 'choice', prompt: 'How many children does 70 have?', options: ['None', 'One', 'Two'], answer: 2, right: 'Two.', wrong: 'Look below 70.' },
    {
      ask: 'node',
      prompt: 'Click the in-order successor of 70.',
      answer: { successorOf: 70 },
      highlight: { outlined: [80] },
      right: '80.',
      wrong: 'Start in the right subtree.',
    },
    {
      ask: 'choice',
      prompt: "What goes into 70's place?",
      options: ['Copy 80 into the node', 'Move 60 up'],
      answer: 0,
      right: 'Copy 80.',
      wrong: 'Use the successor.',
      after: { tree: 'T', highlight: { relabel: { 70: 80 }, ghost: 80 } },
    },
    {
      ask: 'choice',
      prompt: 'What happens to the old 80 node?',
      options: ['Remove it', 'Leave it'],
      answer: 0,
      right: 'Done.',
      wrong: 'It is a duplicate now.',
      after: { tree: { from: 'T', delete: [70] }, highlight: { found: 80 } },
    },
  ],
};

function lessonWith(change: (raw: Record<string, any>) => void): LessonSpec {
  const raw = mini();
  change(raw);
  return validateLesson(raw);
}

// ---------------------------------------------------------------- validateLesson

describe('validateLesson: accepting a lesson', () => {
  it('accepts a lesson using every kind of stage and returns the same content', () => {
    expect(validateLesson(mini())).toEqual(mini());
  });

  it('returns a frozen copy', () => {
    const raw = mini();
    const lesson = validateLesson(raw);
    expect(lesson).not.toBe(raw);
    expect(Object.isFrozen(lesson)).toBe(true);
    expect(Object.isFrozen(lesson.activity.items[0])).toBe(true);
  });

  it('accepts both guided try-its', () => {
    expect(() => lessonWith((raw) => (raw.tryIt = LESSON1_TRY_IT))).not.toThrow();
    expect(() => lessonWith((raw) => (raw.tryIt = LESSON5_TRY_IT))).not.toThrow();
  });
});

describe('validateLesson: naming the exact place of a mistake', () => {
  const rejects = (change: (raw: Record<string, any>) => void, where: RegExp) => {
    const raw = mini();
    change(raw);
    expect(() => validateLesson(raw, 'lesson2.json')).toThrow(where);
  };

  it('names the file', () => {
    rejects((raw) => delete raw.title, /^lesson2\.json: /);
  });

  it('rejects a missing or unknown field', () => {
    rejects((raw) => delete raw.title, /title/);
    rejects((raw) => (raw.titel = 'Search'), /titel/);
    rejects((raw) => delete raw.hook.scenario.text, /hook\.scenario\.text/);
  });

  it('rejects a lesson number or outcome that does not exist', () => {
    rejects((raw) => (raw.lesson = 6), /lesson/);
    rejects((raw) => (raw.outcomes = []), /outcomes/);
    rejects((raw) => (raw.outcomes = ['LO7']), /outcomes\[0\]/);
  });

  it('rejects braces in stage text, which never changes keys', () => {
    rejects((raw) => (raw.hook.goal = 'Search for {60}.'), /hook\.goal/);
    rejects((raw) => (raw.explain.pages[0].steps[1] = 'Go {left}.'), /explain\.pages\[0\]\.steps\[1\]/);
  });

  it('rejects an answer that is not one of the options', () => {
    rejects((raw) => (raw.hook.warmUp.answer = 2), /hook\.warmUp\.answer/);
    rejects((raw) => (raw.explore[1].answer = 2), /explore\[1\]\.answer/);
    rejects((raw) => (raw.explore[7].answer = 2), /explore\[7\]\.answer/);
  });

  it('rejects an unknown kind of stage or step', () => {
    rejects((raw) => (raw.explore[0].kind = 'spin'), /explore\[0\]\.kind/);
    rejects((raw) => (raw.tryIt.kind = 'spin'), /tryIt\.kind/);
    rejects((raw) => (raw.worked.examples[0].steps[0] = { search: { tree: 'T', key: 60 }, insert: { tree: 'T', key: 65 } }), /worked\.examples\[0\]\.steps\[0\]/);
    rejects((raw) => (raw.explain.pages[0].pseudocode = 'sort'), /explain\.pages\[0\]\.pseudocode/);
  });

  it('rejects a highlight field that does not exist', () => {
    rejects((raw) => (raw.explain.pages[0].diagram.highlight.glow = [50]), /explain\.pages\[0\]\.diagram\.highlight\.glow/);
  });

  it('rejects a key that is not a whole number', () => {
    rejects((raw) => (raw.explore[2].key = '60'), /explore\[2\]\.key/);
    rejects((raw) => (raw.activity.items[0].ask.key = 2.5), /activity\.items\[0\]\.ask\.key/);
  });

  it('rejects activity items with a missing field, an unknown task, or a bad part', () => {
    rejects((raw) => delete raw.activity.items[0].explanation, /activity\.items\[0\]\.explanation/);
    rejects((raw) => (raw.activity.items[0].ask.kind = 'guess'), /activity\.items\[0\]\.ask\.kind/);
    rejects(
      (raw) => (raw.activity.items[0].parts = [{ type: 'pick', answer: 0 }]),
      /activity\.items\[0\]\.parts\[0\]\.options/,
    );
    rejects((raw) => (raw.activity.items[0].hints = 'none'), /activity\.items\[0\]\.hints/);
  });

  it('rejects an item whose outcome is not one of the lesson\'s', () => {
    rejects((raw) => (raw.activity.items[0].outcome = 'LO6'), /activity\.items\[0\]\.outcome/);
  });

  it('rejects two items with the same id', () => {
    rejects((raw) => raw.activity.items.push({ ...raw.activity.items[0] }), /mini-1/);
  });

  it('rejects a guided step with an unknown kind of node fact', () => {
    rejects((raw) => (raw.tryIt = { ...LESSON1_TRY_IT, steps: [{ ...LESSON1_TRY_IT.steps[0], answer: 'trunk' }] }), /tryIt\.steps\[0\]\.answer/);
  });
});

// ---------------------------------------------------------------- resolveLesson

describe('resolveLesson: hook, explain and worked examples', () => {
  // Built inside each test, so a failure shows against the test rather than stopping the file loading.
  const build = () => resolveLesson(validateLesson(mini()));
  let lesson: ReturnType<typeof build>;
  beforeEach(() => {
    lesson = build();
  });

  it('keeps the text and builds the warm-up tree', () => {
    expect(lesson.title).toBe('Search');
    expect(lesson.hook.goal).toBe('Trace a search.');
    expect(sameTree(lesson.hook.warmUp.tree ?? null, getTree('T'))).toBe(true);
  });

  it('builds diagrams and attaches the pseudocode lines', () => {
    const page = lesson.explain.pages[0];
    expect(sameTree(page?.diagram?.tree ?? null, getTree('T'))).toBe(true);
    expect(page?.diagram?.highlight).toEqual({ edgeLabels: [[50, 30, 'smaller: left']], dots: 'all' });
    expect(page?.pseudocode).toEqual({ name: 'search', lines: PSEUDOCODE.search });
    expect(page?.terms).toEqual([{ group: 'Shape words', items: [{ term: 'Node', meaning: 'one item in the tree' }] }]);
  });

  it('builds worked examples from the engine, joining several step specs in order', () => {
    const t = getTree('T');
    const [search, extremes, del, written] = lesson.worked.examples;
    expect(search?.steps).toEqual(searchSteps(t, 60));
    expect(search?.pseudocode?.name).toBe('search');
    expect(extremes?.steps).toEqual([...extremeSteps(t, 'min'), ...extremeSteps(t, 'max')]);
    expect(extremes).not.toHaveProperty('pseudocode');
    expect(del?.steps).toEqual(deleteSteps(t, 70));
    expect(del?.deleteCase).toBe('two');
    expect(written?.steps).toEqual([
      { tree: getTree('X'), highlight: { offender: 40 }, text: '40 is smaller than 50 but sits on its right.' },
    ]);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(lesson)).toBe(true);
    expect(Object.isFrozen(lesson.explore)).toBe(true);
    expect(Object.isFrozen(lesson.worked.examples[3]?.steps[0])).toBe(true);
  });

  it('keeps the activity items for activityQuestions', () => {
    expect(lesson.activity.items.map((item) => item.id)).toEqual(['mini-1']);
  });
});

describe('resolveLesson: explore', () => {
  let relatives: Explore | undefined, pick: Explore | undefined, free: Explore | undefined, probe: Explore | undefined;
  let walk: Explore | undefined, guess: Explore | undefined, tryDelete: Explore | undefined, reflect: Explore | undefined;
  beforeEach(() => {
    [relatives, pick, free, probe, walk, guess, tryDelete, reflect] = resolveLesson(validateLesson(mini())).explore;
  });
  const t = getTree('T');

  it('builds the trees for clicking and picking', () => {
    expect(relatives).toMatchObject({ kind: 'relatives', need: 3 });
    expect(pick?.kind === 'pickTree' && pick.trees.map(({ label, tree }) => [label, toShape(tree)])).toEqual([
      ['A', toShape(t)],
      ['B', toShape(getTree('X'))],
    ]);
  });

  it('works out the search path for 60: 50, 70, 60', () => {
    expect(free).toMatchObject({ kind: 'freeSearch', key: 60, path: [50, 70, 60] });
  });

  it('works out where 45 belongs: right of 40', () => {
    expect(probe).toMatchObject({ kind: 'slotProbe', key: 45, slot: { parent: 40, side: 'right' } });
  });

  it('attaches the marker walk, and the pre-order sequence to guess', () => {
    expect(walk?.kind === 'walk' && walk.steps).toEqual(walkSteps(t));
    expect(guess).toMatchObject({ kind: 'orderGuess', order: 'pre', answer: [50, 30, 20, 40, 70, 60, 80] });
  });

  it('works out each delete move, whether it is possible, and whether it keeps the BST rule', () => {
    if (tryDelete?.kind !== 'deleteTry') throw new Error('expected deleteTry');
    const [move] = tryDelete.cases;
    expect(move?.deleteCase).toBe('two');
    const [engine, drawn, gap] = move?.options ?? [];
    expect(toShape(engine?.result ?? null)).toEqual([50, [30, [20], [40]], [80, [60]]]);
    expect(engine).toMatchObject({ valid: true, possible: true });
    // Moving 60 up also keeps the rule here, which is what the note explains.
    expect(drawn).toMatchObject({ valid: true, possible: true });
    expect(gap).toMatchObject({ result: null, valid: false, possible: false });
  });

  it('keeps a reflection with no right answer', () => {
    expect(reflect).toMatchObject({ kind: 'reflect', answer: null });
  });
});

describe('resolveLesson: try it', () => {
  it('search for 80 visits 50, 70, 80 and finds it', () => {
    const { tryIt } = resolveLesson(validateLesson(mini()));
    expect(tryIt).toMatchObject({ kind: 'search', key: 80, path: [50, 70, 80], found: true });
    expect(tryIt.kind === 'search' && tryIt.solution).toEqual(searchSteps(getTree('T'), 80));
  });

  it('insert 65 visits 50, 70, 60 and goes right of 60', () => {
    const { tryIt } = resolveLesson(lessonWith((raw) => (raw.tryIt = { kind: 'insert', title: 'Insert 65', tree: 'T', key: 65 })));
    expect(tryIt).toMatchObject({ kind: 'insert', path: [50, 70, 60], slot: { parent: 60, side: 'right' } });
  });

  it('pre-order of the subtree rooted at 30 is 30, 20, 40', () => {
    const { tryIt } = resolveLesson(
      lessonWith((raw) => (raw.tryIt = { kind: 'traversal', title: 'Pre-order', tree: 'T', order: 'pre', from: 30 })),
    );
    expect(tryIt).toMatchObject({ kind: 'traversal', sequence: [30, 20, 40] });
    expect(tryIt.kind === 'traversal' && tryIt.solution).toEqual(traversalSteps(subtree(getTree('T'), 30), 'pre'));
  });

  it('Lesson 1: works out the root, the leaves and the parent of 40, and the range right of 60 (61 to 69)', () => {
    const { tryIt } = resolveLesson(lessonWith((raw) => (raw.tryIt = LESSON1_TRY_IT)));
    if (tryIt.kind !== 'guided') throw new Error('expected guided');
    const [root, leaf, parent, range] = tryIt.steps;
    expect(root).toMatchObject({ ask: 'node', accept: [50], tag: 'root' });
    expect(leaf).toMatchObject({ accept: [20, 40, 60, 80] });
    expect(parent).toMatchObject({ accept: [30] });
    expect(range).toMatchObject({ ask: 'choice', highlight: { slot: { parent: 60, side: 'right' }, slotLabel: '61 to 69' } });
  });

  it('Lesson 5: works out the successor of 70 (80) and the tree after the delete', () => {
    const { tryIt } = resolveLesson(lessonWith((raw) => (raw.tryIt = LESSON5_TRY_IT)));
    if (tryIt.kind !== 'guided') throw new Error('expected guided');
    expect(tryIt.steps[1]).toMatchObject({ ask: 'node', accept: [80], highlight: { outlined: [80] } });
    const after = tryIt.steps[3]?.ask === 'choice' ? tryIt.steps[3].after : undefined;
    expect(toShape(after?.tree ?? null)).toEqual([50, [30, [20], [40]], [80, [60]]]);
    expect(after?.highlight).toEqual({ found: 80 });
  });
});

describe('resolveLesson: mistakes in a stage', () => {
  const rejects = (change: (raw: Record<string, any>) => void, where: RegExp) => {
    expect(() => resolveLesson(lessonWith(change))).toThrow(where);
  };

  it('names the stage when a tree does not exist', () => {
    rejects((raw) => (raw.explain.pages[0].diagram.tree = 'Q'), /explain page 1.*Q/);
    rejects((raw) => (raw.explore[2].tree = 'Q'), /explore 3.*Q/);
  });

  it('rejects a highlight key that is not in the tree', () => {
    rejects((raw) => (raw.worked.examples[3].steps[0].highlight = { offender: 45 }), /worked example 4.*45/);
  });

  it('rejects an allowed-range bubble on a spot that is taken, like the left of 70 in T', () => {
    rejects(
      (raw) => (raw.tryIt = { ...LESSON1_TRY_IT, steps: [{ ...LESSON1_TRY_IT.steps[3], highlight: { slot: { parent: 70, side: 'left' } } }] }),
      /try it step 1.*not an empty spot/,
    );
  });

  it('rejects an allowed-range bubble with no spot to show it at', () => {
    rejects(
      (raw) => (raw.tryIt = { ...LESSON1_TRY_IT, steps: [{ ...LESSON1_TRY_IT.steps[3], highlight: {} }] }),
      /try it step 1.*slot/,
    );
  });

  it('rejects a delete case that does not match the engine', () => {
    rejects((raw) => (raw.worked.examples[2].deleteCase = 'leaf'), /worked example 3.*two/);
  });

  it('rejects a search or probe that cannot work: a missing key to delete, or a key already in the tree to place', () => {
    rejects((raw) => (raw.explore[3].key = 40), /explore 4.*40/);
    rejects((raw) => (raw.explore[6].cases[0].key = 65), /explore 7.*65/);
  });
});