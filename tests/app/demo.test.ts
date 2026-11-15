import { describe, expect, it } from 'vitest';
import { activityQuestions, finalQuestions } from '../../src/content';
import { answerText, isDemo } from '../../src/app/demo';

describe('isDemo', () => {
  it('is on only when ?demo is in the address', () => {
    expect(isDemo('?demo')).toBe(true);
    expect(isDemo('?demo=1')).toBe(true);
    expect(isDemo('?x=1&demo')).toBe(true);
    expect(isDemo('')).toBe(false);
    expect(isDemo('?demonstration')).toBe(false);
  });
});

describe('answerText', () => {
  it('writes out each kind of answer', () => {
    expect(answerText({ type: 'pick', label: '', options: ['Yes', 'No'], answer: 1 })).toBe('No');
    expect(answerText({ type: 'click', label: '', mode: 'one', answer: 40 })).toBe('40');
    expect(answerText({ type: 'click', label: '', mode: 'path', answer: [50, 30, 20] })).toBe('50, 30, 20');
    expect(answerText({ type: 'order', label: '', cards: [30, 20], answer: [20, 30] })).toBe('20, 30');
    expect(answerText({
      type: 'place', label: '', keys: [40, 20],
      answer: [{ parent: null, side: 'left' }, { parent: 40, side: 'left' }],
    })).toBe('40 at the root; 20 at the left of 40');
  });

  it('gives a non-empty answer for every part of every lesson and final test question', () => {
    const questions = [
      ...([1, 2, 3, 4, 5] as const).flatMap((n) => activityQuestions(n, 0)),
      ...finalQuestions(0),
    ];
    for (const question of questions) {
      for (const part of question.parts) expect(answerText(part), question.id).not.toBe('');
    }
  });
});
