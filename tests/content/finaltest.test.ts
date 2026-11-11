/**
 * The final test (src/content/data/final.json). Expected answers are from the
 * lesson plan's final test table; the results rules are from the lesson plan
 * and the ID document ("An outcome is shown as secure when every item for it
 * is correct"; the Excellent band needs the two-children delete).
 */
import { describe, expect, it } from 'vitest';
import {
  CONFIG,
  FINAL_TEST,
  LESSON_SPECS,
  finalQuestions,
  finalResults,
  offsetFor,
  validateFinal,
} from '../../src/content';
import type { Part, Question } from '../../src/content';
import { preorder, toShape } from '../../src/engine';

const RETAKES = CONFIG.retakeOffsets.map((_, retake) => retake);
const IDS = () => FINAL_TEST.items.map((item) => item.id);

function answerOf(part: Part): unknown {
  return part.type === 'pick' ? part.options[part.answer] : part.answer;
}

function question(id: string, retake = 0): Question {
  const found = finalQuestions(retake).find((q) => q.id === id);
  if (found === undefined) throw new Error(`no item ${id}`);
  return found;
}

/** Every item right, except the ones listed. */
function marks(wrong: string[] = []): Record<string, boolean> {
  return Object.fromEntries(IDS().map((id) => [id, !wrong.includes(id)]));
}

// ---------------------------------------------------------------- the questions

describe('the final test questions', () => {
  it('has ten items with the outcomes from the lesson plan table', () => {
    expect(FINAL_TEST.items.map((item) => item.outcome)).toEqual([
      'LO1',
      'LO2',
      'LO2',
      'LO3',
      'LO4',
      'LO4',
      'LO5',
      'LO5',
      'LO6',
      'LO6',
    ]);
  });

  it('has the lesson plan answers', () => {
    expect(finalQuestions().map((q) => q.parts.map(answerOf))).toEqual([
      [[35, 10, 22, 45, 60], '3'], // root 35; leaves 10, 22, 45, 60; height 3
      ['Invalid', 35], // V: 35 is larger than 30 but on the left
      ['Valid: every key is on the correct side of every ancestor'], // W
      [[35, 50, 45], 'Not found'], // search 47
      [[{ parent: 60, side: 'left' }]], // insert 55: left child of 60
      [10, 60], // minimum and maximum
      [[10, 20, 22, 25, 35, 45, 50, 60]], // in-order
      [[10, 22, 25, 20, 45, 60, 50, 35]], // post-order
      ['One child', '22 becomes the right child of 20'], // delete 25
      ['Two children', 22, 'The node becomes 22, with left child 10 and right child 25'], // delete 20
    ]);
  });

  it('shows the trees the lesson plan gives after each delete', () => {
    expect(toShape(question('final-delete-25').result?.tree ?? null)).toEqual([35, [20, [10], [22]], [50, [45], [60]]]);
    expect(toShape(question('final-delete-20').result?.tree ?? null)).toEqual([35, [22, [10], [25]], [50, [45], [60]]]);
  });

  it('gives no hints, as the lesson plan says', () => {
    for (const q of finalQuestions()) expect(q.hints, q.id).toEqual([]);
  });

  it('marks every question as the final test', () => {
    for (const q of finalQuestions()) expect(q.lesson).toBe('final');
  });

  it('assesses every outcome at least once', () => {
    expect(new Set(FINAL_TEST.items.map((item) => item.outcome))).toEqual(
      new Set(FINAL_TEST.outcomes.map((outcome) => outcome.id)),
    );
  });

  it('uses item ids no lesson uses', () => {
    const lessonIds = new Set([1, 2, 3, 4, 5].flatMap((n) => LESSON_SPECS[n as 1].activity.items.map((i) => i.id)));
    for (const id of IDS()) expect(lessonIds.has(id), id).toBe(false);
  });

  it('asks the same questions with new keys on every retake', () => {
    const back = (q: Question, offset: number) => {
      const keys = new Set([...preorder(q.tree), ...preorder(q.result?.tree ?? null)]);
      const shift = (key: number) => key - offset;
      return q.parts.map((part) => {
        switch (part.type) {
          case 'pick':
            if (part.options.every((option) => /^\d+$/.test(option))) return part.options[part.answer];
            return part.options[part.answer]?.replace(/\d+/g, (d) => (keys.has(Number(d)) ? String(shift(Number(d))) : d));
          case 'click':
            return typeof part.answer === 'number' ? shift(part.answer) : part.answer.map(shift);
          case 'order':
            return part.answer.map(shift);
          case 'place':
            return part.answer.map((slot) => (slot.parent === null ? slot : { ...slot, parent: shift(slot.parent) }));
        }
      });
    };
    const original = finalQuestions(0).map((q) => back(q, 0));
    for (const retake of RETAKES) {
      expect(finalQuestions(retake).map((q) => back(q, offsetFor(retake)))).toEqual(original);
    }
  });

  it('keeps the wording for the test screen', () => {
    expect(FINAL_TEST.summary).toBe('Ten questions on a new tree. No hints, no timer, and you can retake it with new numbers.');
    expect(FINAL_TEST.minutes).toBe(10);
  });
});

// ---------------------------------------------------------------- the results

describe('finalResults', () => {
  it('all right: 10 of 10, every outcome secure, Excellent, and the LO6 lecture question', () => {
    const results = finalResults(marks());
    expect(results.score).toBe(10);
    expect(results.total).toBe(10);
    expect(results.outcomes.every((outcome) => outcome.secure)).toBe(true);
    expect(results.descriptor.name).toBe('Excellent');
    expect(results.lectureQuestion).toBe(FINAL_TEST.outcomes.find((o) => o.id === 'LO6')?.lectureQuestion);
  });

  it('9 of 10 with the two-children delete right is Excellent; the missed outcome is not secure', () => {
    const results = finalResults(marks(['final-search-47']));
    expect(results.score).toBe(9);
    expect(results.descriptor.name).toBe('Excellent');
    expect(results.outcomes.find((o) => o.id === 'LO3')?.secure).toBe(false);
    expect(results.lectureQuestion).toBe(FINAL_TEST.outcomes.find((o) => o.id === 'LO3')?.lectureQuestion);
  });

  it('9 of 10 with the two-children delete wrong is Good, as the ID document says', () => {
    expect(finalResults(marks(['final-delete-20'])).descriptor.name).toBe('Good');
  });

  it('uses the bands 9-10, 7-8, 5-6 and 0-4', () => {
    const ids = IDS();
    const named = (wrong: number) => finalResults(marks(ids.slice(0, wrong))).descriptor.name;
    expect([0, 1, 2, 3, 4, 5, 6, 10].map(named)).toEqual([
      'Excellent',
      'Excellent',
      'Good',
      'Good',
      'Satisfactory',
      'Satisfactory',
      'Limited',
      'Limited',
    ]);
  });

  it('makes an outcome secure only when every item for it is right', () => {
    const results = finalResults(marks(['final-valid-w']));
    expect(results.outcomes.map((o) => [o.id, o.secure])).toEqual([
      ['LO1', true],
      ['LO2', false],
      ['LO3', true],
      ['LO4', true],
      ['LO5', true],
      ['LO6', true],
    ]);
  });

  it('asks about the first outcome that is not secure', () => {
    const results = finalResults(marks(['final-post-order', 'final-invalid-v']));
    expect(results.lectureQuestion).toBe(FINAL_TEST.outcomes.find((o) => o.id === 'LO2')?.lectureQuestion);
  });

  it('never says "failed"', () => {
    const text = JSON.stringify(finalResults(marks(IDS())));
    expect(text.toLowerCase()).not.toContain('fail');
  });

  it('needs a right or wrong for every item, and nothing else', () => {
    const all = marks();
    const { ['final-delete-20']: _, ...missing } = all;
    expect(() => finalResults(missing)).toThrow(TypeError);
    expect(() => finalResults({ ...all, 'l2-search-20': true })).toThrow(TypeError);
    expect(() => finalResults({ ...all, 'final-delete-20': 'yes' } as unknown as Record<string, boolean>)).toThrow(
      TypeError,
    );
  });

  it('is frozen', () => {
    const results = finalResults(marks());
    expect(Object.isFrozen(results)).toBe(true);
    expect(Object.isFrozen(results.outcomes[0])).toBe(true);
  });
});

// ---------------------------------------------------------------- the file's checks

describe('validateFinal', () => {
  /** A fresh copy of the final test file, to break in one place. */
  const raw = (): any => JSON.parse(JSON.stringify(FINAL_TEST));
  const rejects = (change: (file: any) => void, where: RegExp) => {
    const file = raw();
    change(file);
    expect(() => validateFinal(file, 'final.json')).toThrow(where);
  };

  it('accepts the shipped file', () => {
    expect(validateFinal(raw())).toEqual(FINAL_TEST);
  });

  it('rejects a hint, since the final test has none', () => {
    rejects((file) => (file.items[0].hints = [{ text: 'A nudge.' }]), /items\[0\]\.hints/);
  });

  it('rejects an outcome that no item assesses', () => {
    rejects((file) => (file.items = file.items.filter((item: any) => item.outcome !== 'LO3')), /LO3/);
  });

  it('rejects an item whose outcome is not listed', () => {
    rejects((file) => (file.outcomes = file.outcomes.filter((o: any) => o.id !== 'LO1')), /LO1/);
  });

  it('rejects descriptors that are not from highest to lowest, ending at 0', () => {
    rejects((file) => file.descriptors.reverse(), /descriptors/);
    rejects((file) => (file.descriptors.at(-1).min = 1), /descriptors/);
  });

  it('rejects a descriptor that needs an item that does not exist', () => {
    rejects((file) => (file.descriptors[0].requires = ['final-delete-99']), /final-delete-99/);
  });

  it('rejects a descriptor band higher than the number of items', () => {
    rejects((file) => (file.descriptors[0].min = 11), /descriptors\[0\]\.min/);
  });

  it('rejects braces in the screen wording, which never changes keys', () => {
    rejects((file) => (file.summary = 'Ten questions on tree {35}.'), /summary/);
  });

  it('rejects two items with the same id', () => {
    rejects((file) => (file.items[1].id = file.items[0].id), /final-root-leaves-height/);
  });
});