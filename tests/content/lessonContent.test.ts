/**
 * The five lessons as written in src/content/data. Every answer is checked
 * against the lesson plan's tables, every item is resolved on every retake,
 * and the facts the stage text states are checked against the engine.
 */
import { describe, expect, it } from 'vitest';
import {
  CONFIG,
  LESSON_SPECS,
  activityQuestions,
  getLesson,
  offsetFor,
  resolveItem,
} from '../../src/content';
import type { Lesson, LessonNumber, Part, Question } from '../../src/content';
import {
  checkBST,
  depth,
  height,
  inorder,
  postorder,
  preorder,
  remove,
  sameTree,
  subtree,
  successor,
  toShape,
} from '../../src/engine';
import { T_SHAPE, X_SHAPE } from '../engine/fixtures';

const LESSONS: LessonNumber[] = [1, 2, 3, 4, 5];
const RETAKES = CONFIG.retakeOffsets.map((_, retake) => retake);

/** The answers of a lesson's activity on retake 0, one list per item. */
function answers(n: LessonNumber): unknown[][] {
  return activityQuestions(n).map((question) => question.parts.map(answerOf));
}

/** A part's answer, with a pick part given as its option text so the shuffle doesn't matter. */
function answerOf(part: Part): unknown {
  return part.type === 'pick' ? part.options[part.answer] : part.answer;
}

function question(n: LessonNumber, id: string, retake = 0): Question {
  const found = activityQuestions(n, retake).find((q) => q.id === id);
  if (found === undefined) throw new Error(`no item ${id} in lesson ${n}`);
  return found;
}

// ---------------------------------------------------------------- every lesson

describe('every lesson', () => {
  it.each(LESSONS)('lesson %i loads, and its file says it is that lesson', (n) => {
    expect(LESSON_SPECS[n].lesson).toBe(n);
    expect(getLesson(n).lesson).toBe(n);
  });

  it('has the activity sizes from the lesson plan: 6, 5, 6, 6 and 6 items', () => {
    expect(LESSONS.map((n) => LESSON_SPECS[n].activity.items.length)).toEqual([6, 5, 6, 6, 6]);
  });

  it('has the outcomes and minutes from the lesson plan', () => {
    expect(LESSONS.map((n) => [getLesson(n).outcomes, getLesson(n).minutes])).toEqual([
      [['LO1', 'LO2'], 15],
      [['LO3'], 12],
      [['LO4'], 15],
      [['LO5'], 15],
      [['LO6'], 18],
    ]);
  });

  it('uses each item id only once across all lessons', () => {
    const ids = LESSONS.flatMap((n) => LESSON_SPECS[n].activity.items.map((item) => item.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every item a nudge and a highlighted hint, the first two rungs of the ladder', () => {
    for (const n of LESSONS) {
      for (const item of LESSON_SPECS[n].activity.items) {
        expect(item.hints, item.id).toHaveLength(CONFIG.hintRungs - 1);
      }
    }
  });

  it.each(LESSONS)('lesson %i: every item resolves on every retake', (n) => {
    for (const retake of RETAKES) {
      expect(() => activityQuestions(n, retake)).not.toThrow();
    }
  });

  it.each(LESSONS)('lesson %i: every retake asks the same questions with the keys shifted', (n) => {
    const shiftedBack = (q: Question, offset: number) => {
      const keys = new Set([...preorder(q.tree), ...preorder(q.result?.tree ?? null)]);
      const back = (key: number) => key - offset;
      return q.parts.map((part) => {
        switch (part.type) {
          case 'pick':
            if (part.options.every((option) => /^\d+$/.test(option))) return part.options[part.answer];
            return part.options[part.answer]?.replace(/\d+/g, (d) => (keys.has(Number(d)) ? String(back(Number(d))) : d));
          case 'click':
            return typeof part.answer === 'number' ? back(part.answer) : part.answer.map(back);
          case 'order':
            return part.answer.map(back);
          case 'place':
            return part.answer.map((slot) => (slot.parent === null ? slot : { ...slot, parent: back(slot.parent) }));
        }
      });
    };
    const original = activityQuestions(n, 0).map((q) => shiftedBack(q, 0));
    for (const retake of RETAKES) {
      expect(activityQuestions(n, retake).map((q) => shiftedBack(q, offsetFor(retake)))).toEqual(original);
    }
  });

  it.each(LESSONS)('lesson %i: activityQuestions gives the same questions as resolving each item', (n) => {
    const items = LESSON_SPECS[n].activity.items;
    expect(activityQuestions(n, 2)).toEqual(items.map((item) => resolveItem(item, n, 2)));
  });

  it('caches each lesson, so the screens get the same object every time', () => {
    expect(getLesson(3)).toBe(getLesson(3));
  });

  it('rejects a lesson number that does not exist', () => {
    expect(() => getLesson(6 as LessonNumber)).toThrow(RangeError);
    expect(() => activityQuestions(0 as LessonNumber)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------- Lesson 1

describe('Lesson 1: Trees and the BST rule', () => {
  it('activity "Spot the BST" has the lesson plan answers', () => {
    expect(answers(1)).toEqual([
      [[50, 20, 40, 60, 80]], // root 50; leaves 20, 40, 60, 80
      ['2', '1'], // depth of 40; height of the subtree rooted at 30
      ['Valid'], // T
      ['Invalid', 40], // X
      ['Invalid', 55], // the 55 tree
      ['False'], // checking parent against children is not enough
    ]);
  });

  it('the worked example states true facts about T and X', () => {
    const t = getLesson(1).worked.examples[0]?.steps[0]?.tree ?? null;
    expect(toShape(t)).toEqual(T_SHAPE);
    expect(depth(t, 40)).toBe(2);
    expect(height(subtree(t, 30))).toBe(1);
    expect(height(t)).toBe(2);
    const x = getLesson(1).worked.examples[1]?.steps[0]?.tree ?? null;
    expect(toShape(x)).toEqual(X_SHAPE);
    expect(checkBST(x).offender).toBe(40);
  });

  it('the try-it accepts root 50, any leaf, and parent 30, and shows 61 to 69 right of 60', () => {
    const tryIt = getLesson(1).tryIt;
    if (tryIt.kind !== 'guided') throw new Error('expected a guided try-it');
    expect(tryIt.steps.map((step) => (step.ask === 'node' ? step.accept : step.highlight.slotLabel))).toEqual([
      [50],
      [20, 40, 60, 80],
      [30],
      '61 to 69',
    ]);
    const range = tryIt.steps[3];
    expect(range?.ask === 'choice' && range.options[range.answer]).toBe('65');
  });

  it('explore: only tree A lets a search always choose a side', () => {
    const pick = getLesson(1).explore.find((entry) => entry.kind === 'pickTree');
    if (pick?.kind !== 'pickTree') throw new Error('expected pickTree');
    expect(pick.trees.map(({ tree }) => checkBST(tree).valid)).toEqual([true, false, false]);
    expect(pick.answer).toBe(0);
  });
});

// ---------------------------------------------------------------- Lesson 2

describe('Lesson 2: Search', () => {
  it('activity "Find the path" has the lesson plan answers', () => {
    expect(answers(2)).toEqual([
      [[50, 30, 20], 'Found'], // search 20
      ['50, 70, 60, then an empty spot: not found'], // search 65
      [40, 'Right'], // 45 ends at the right side of 40
      ['3'], // most nodes visited
      ['Not found'], // reaching an empty spot
    ]);
  });

  it('the worked examples search for 60 (found) and 45 (not found)', () => {
    const [sixty, fortyFive] = getLesson(2).worked.examples;
    expect(sixty?.steps.at(-1)?.highlight.found).toBe(60);
    expect(fortyFive?.steps.at(-1)?.highlight.slot).toEqual({ parent: 40, side: 'right' });
  });

  it('the try-it searches for 80 along 50, 70, 80, and explore searches for 60', () => {
    expect(getLesson(2).tryIt).toMatchObject({ kind: 'search', path: [50, 70, 80], found: true });
    expect(getLesson(2).explore[0]).toMatchObject({ kind: 'freeSearch', path: [50, 70, 60] });
  });
});

// ---------------------------------------------------------------- Lesson 3

describe('Lesson 3: Insert, minimum and maximum', () => {
  it('activity "Grow the tree" has the lesson plan answers', () => {
    expect(answers(3)).toEqual([
      [[{ parent: 20, side: 'left' }]], // 10: left child of 20
      [[{ parent: 60, side: 'left' }]], // 55: left child of 60
      ['Nothing changes: duplicates are not added'], // 50 again
      [
        [
          { parent: null, side: null },
          { parent: 40, side: 'left' },
          { parent: 40, side: 'right' },
          { parent: 20, side: 'left' },
        ],
      ], // build 40, 20, 60, 10
      [20, 80], // minimum and maximum
      [60], // smallest key in the subtree rooted at 70
    ]);
  });

  it('builds root 40 with left child 20 (left child 10) and right child 60', () => {
    expect(toShape(question(3, 'l3-build').result?.tree ?? null)).toEqual([40, [20, [10]], [60]]);
  });

  it('bridges the subtree minimum to delete', () => {
    expect(question(3, 'l3-subtree-min').bridge).toBe('Remember this one for delete.');
  });

  it('the worked examples build T, insert 45 to give T2, and find 20 and 80', () => {
    const [buildT, insert45, minMax] = getLesson(3).worked.examples;
    expect(toShape(buildT?.steps.at(-1)?.tree ?? null)).toEqual(T_SHAPE);
    expect(insert45?.steps.at(-1)?.highlight.found).toBe(45);
    expect(minMax?.steps.filter((step) => step.highlight.found !== undefined).map((step) => step.highlight.found)).toEqual([
      20, 80,
    ]);
  });

  it('the try-it inserts 65 after visiting 50, 70, 60, as the right child of 60', () => {
    expect(getLesson(3).tryIt).toMatchObject({
      kind: 'insert',
      path: [50, 70, 60],
      slot: { parent: 60, side: 'right' },
    });
  });

  it('explore: 45 belongs right of 40', () => {
    expect(getLesson(3).explore[0]).toMatchObject({ kind: 'slotProbe', slot: { parent: 40, side: 'right' } });
  });
});

// ---------------------------------------------------------------- Lesson 4

describe('Lesson 4: Traversals', () => {
  it('activity "Walk the tree" has the lesson plan answers', () => {
    expect(answers(4)).toEqual([
      [[20, 30, 40, 50, 60, 70, 80]], // in-order of T
      [[50, 30, 20, 40, 70, 60, 80]], // pre-order of T
      [[20, 40, 30, 60, 80, 70, 50]], // post-order of T
      [[70, 60, 80]], // pre-order of the subtree rooted at 70
      [[20, 45, 40, 30, 60, 80, 70, 50]], // post-order of T2
      [
        'Every left key is smaller and every right key is larger, so writing left, then node, then right goes from small to large',
      ],
    ]);
  });

  it('the comparison step writes the three sequences of T correctly', () => {
    const compare = getLesson(4).worked.examples.at(-1)?.steps[0];
    const t = compare?.tree ?? null;
    expect(compare?.text).toBe(
      `Pre-order: ${preorder(t).join(' ')}. In-order: ${inorder(t).join(' ')}. Post-order: ${postorder(t).join(' ')}.`,
    );
  });

  it('the try-it is pre-order of the subtree rooted at 30: 30, 20, 40', () => {
    expect(getLesson(4).tryIt).toMatchObject({ kind: 'traversal', sequence: [30, 20, 40] });
  });
});

// ---------------------------------------------------------------- Lesson 5

describe('Lesson 5: Delete', () => {
  it('activity "Remove it" has the lesson plan answers', () => {
    expect(answers(5)).toEqual([
      ['Leaf', '70 keeps only its right child 80'], // delete 60
      ['One child', "45 takes 40's place as the right child of 30"], // delete 40 from T2
      ['Two children', 40, 'The node becomes 40, with left child 20 and no right child'], // delete 30
      ['Two children', 60, 'The root becomes 60, and 70 keeps only its right child 80'], // delete 50
      [60], // successor of 50
      ['Yes'], // still sorted
    ]);
  });

  it('the written result for each delete matches the tree the engine gives', () => {
    expect(toShape(question(5, 'l5-delete-60').result?.tree ?? null)).toEqual([50, [30, [20], [40]], [70, null, [80]]]);
    expect(toShape(question(5, 'l5-delete-40').result?.tree ?? null)).toEqual([50, [30, [20], [45]], [70, [60], [80]]]);
    expect(toShape(question(5, 'l5-delete-30').result?.tree ?? null)).toEqual([50, [40, [20]], [70, [60], [80]]]);
    expect(toShape(question(5, 'l5-delete-50').result?.tree ?? null)).toEqual([60, [30, [20], [40]], [70, null, [80]]]);
  });

  it('covers every delete case, so the one-of-each-case pass rule can be met', () => {
    const cases = activityQuestions(5).map((q) => q.deleteCase).filter((c) => c !== undefined);
    expect(new Set(cases)).toEqual(new Set(['leaf', 'one', 'two']));
  });

  it('asks "still sorted?" on T after deleting the root', () => {
    const q = question(5, 'l5-still-sorted');
    expect(sameTree(q.tree, remove(getLesson(5).worked.examples[0]?.steps[0]?.tree ?? null, 50).tree)).toBe(true);
    expect(inorder(q.tree)).toEqual([20, 30, 40, 60, 70, 80]);
  });

  it('the explain diagram marks 70\'s real successor, 80', () => {
    const diagram = getLesson(5).explain.pages[0]?.diagram;
    expect(diagram?.highlight.found).toBe(successor(diagram?.tree ?? null, 70));
    expect(diagram?.highlight.found).toBe(80);
  });

  it('the worked examples show the three cases, plus deleting the root', () => {
    expect(getLesson(5).worked.examples.map((example) => example.deleteCase)).toEqual(['leaf', 'one', 'two', 'two']);
  });

  it('the try-it finds successor 80 and ends with 80 holding left child 60', () => {
    const tryIt = getLesson(5).tryIt;
    if (tryIt.kind !== 'guided') throw new Error('expected a guided try-it');
    expect(tryIt.steps[1]).toMatchObject({ ask: 'node', accept: [80] });
    const last = tryIt.steps.at(-1);
    expect(toShape(last?.ask === 'choice' ? (last.after?.tree ?? null) : null)).toEqual([50, [30, [20], [40]], [80, [60]]]);
  });

  it('explore: only the engine\'s move is right in each case; the leaf and one-child wrong moves break the rule', () => {
    const tryDelete = getLesson(5).explore.find((entry) => entry.kind === 'deleteTry');
    if (tryDelete?.kind !== 'deleteTry') throw new Error('expected deleteTry');
    expect(tryDelete.cases.map((c) => c.deleteCase)).toEqual(['leaf', 'one', 'two']);
    expect(tryDelete.cases.map((c) => c.options.map((o) => [o.possible, o.valid]))).toEqual([
      [
        [true, true],
        [true, false],
      ],
      [
        [true, true],
        [true, false],
        [false, false],
      ],
      [
        [true, true], // moving 60 up happens to keep the rule here; the note explains why it is not the method
        [true, true],
        [false, false],
      ],
    ]);
  });
});

/** Every lesson's stages, for the shape checks. */
function allLessons(): Lesson[] {
  return LESSONS.map((n) => getLesson(n));
}

describe('stage content', () => {
  it('every lesson has every stage', () => {
    for (const lesson of allLessons()) {
      expect(lesson.hook.goal).not.toBe('');
      expect(lesson.explore.length).toBeGreaterThan(0);
      expect(lesson.explain.pages.length).toBeGreaterThan(0);
      expect(lesson.worked.examples.length).toBeGreaterThan(0);
      expect(lesson.tryIt).toBeDefined();
    }
  });

  it('every worked example has at least one step with a caption', () => {
    for (const lesson of allLessons()) {
      for (const example of lesson.worked.examples) {
        expect(example.steps.length, example.label).toBeGreaterThan(0);
        expect(example.steps.every((step) => step.text.length > 0)).toBe(true);
      }
    }
  });
});