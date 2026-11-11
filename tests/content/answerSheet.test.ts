import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FINAL_TEST, LESSON_SPECS } from '../../src/content';
import { answerInWords, answerSheet, questionAnswer } from '../../src/content/answerSheet';
import type { Question } from '../../src/content';

describe('answers in words', () => {
  it('writes each kind of part the way the lesson plan does', () => {
    expect(answerInWords({ type: 'pick', label: '', options: ['Found', 'Not found'], answer: 1 })).toBe('Not found');
    expect(answerInWords({ type: 'click', label: '', mode: 'one', answer: 40 })).toBe('40');
    expect(answerInWords({ type: 'click', label: '', mode: 'path', answer: [50, 30, 20] })).toBe('50, 30, 20');
    expect(answerInWords({ type: 'order', label: '', cards: [30, 20], answer: [20, 30] })).toBe('20 30');
    expect(
      answerInWords({
        type: 'place',
        label: '',
        keys: [40, 20],
        answer: [
          { parent: null, side: null },
          { parent: 40, side: 'left' },
        ],
      }),
    ).toBe('40 → root; 20 → left of 40');
  });

  it('labels each part of a question that has labels', () => {
    const question = {
      parts: [
        { type: 'click', label: 'Path', mode: 'path', answer: [50, 30, 20] },
        { type: 'pick', label: 'Result', options: ['Found', 'Not found'], answer: 0 },
      ],
    } as unknown as Question;
    expect(questionAnswer(question)).toBe('Path: 50, 30, 20 · Result: Found');
  });

  it('does not put a colon after a label that is a question', () => {
    const question = {
      parts: [{ type: 'pick', label: 'Which case is this?', options: ['Leaf', 'One child', 'Two children'], answer: 0 }],
    } as unknown as Question;
    expect(questionAnswer(question)).toBe('Which case is this? Leaf');
  });
});

describe('the answer sheet', () => {
  const sheet = answerSheet();

  it('lists every lesson and every item', () => {
    for (const n of [1, 2, 3, 4, 5] as const) {
      expect(sheet).toContain(`## Lesson ${n}: ${LESSON_SPECS[n].title}`);
      for (const item of LESSON_SPECS[n].activity.items) expect(sheet).toContain(`\`${item.id}\``);
    }
  });

  it('lists the final test after the lessons, with every item', () => {
    expect(sheet.indexOf('## Final test')).toBeGreaterThan(sheet.indexOf('## Lesson 5'));
    for (const item of FINAL_TEST.items) expect(sheet).toContain(`\`${item.id}\``);
  });

  it('gives the lesson plan answer on retake 0 and the shifted one on retake 1', () => {
    expect(sheet).toContain('| 0 | Path: 50, 30, 20 · Result: Found |');
    expect(sheet).toContain('| 1 | Path: 57, 37, 27 · Result: Found |');
  });

  it('is saved, up to date, in docs/answer-sheet.md (run `npm run answers` if this fails)', () => {
    const file = 'docs/answer-sheet.md';
    expect(existsSync(file), `${file} is missing: run npm run answers`).toBe(true);
    expect(readFileSync(file, 'utf8'), `${file} is out of date: run npm run answers`).toBe(sheet);
  });
});