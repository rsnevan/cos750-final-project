import { describe, expect, it } from 'vitest';
import { CONFIG, feedbackFor, newItem, recordAttempt } from '../../src/assessment';

describe('hint ladder', () => {
  it('starts with no attempts and no feedback', () => {
    const item = newItem();
    expect(item).toEqual({ attempts: 0, rung: 0, solved: false, scored: false });
    expect(feedbackFor(item)).toBe('none');
  });

  it('scores a first-time correct answer', () => {
    const item = recordAttempt(newItem(), true);
    expect(item.solved).toBe(true);
    expect(item.scored).toBe(true);
    expect(feedbackFor(item)).toBe('correct');
  });

  it('climbs one rung per wrong attempt: nudge, highlight, solution', () => {
    let item = recordAttempt(newItem(), false);
    expect(item.rung).toBe(1);
    expect(feedbackFor(item)).toBe('nudge');

    item = recordAttempt(item, false);
    expect(item.rung).toBe(2);
    expect(feedbackFor(item)).toBe('highlight');

    item = recordAttempt(item, false);
    expect(item.rung).toBe(3);
    expect(feedbackFor(item)).toBe('solution');
  });

  it('stays on the top rung after more wrong attempts', () => {
    let item = newItem();
    for (let i = 0; i < 5; i++) item = recordAttempt(item, false);
    expect(item.attempts).toBe(5);
    expect(item.rung).toBe(CONFIG.hintRungs);
  });

  it('still scores an item solved after one or two hints', () => {
    const afterNudge = recordAttempt(recordAttempt(newItem(), false), true);
    expect(afterNudge.scored).toBe(true);

    const afterHighlight = recordAttempt(recordAttempt(recordAttempt(newItem(), false), false), true);
    expect(afterHighlight.scored).toBe(true);
  });

  it('does not score an item solved after the worked solution was shown', () => {
    let item = newItem();
    for (let i = 0; i < 3; i++) item = recordAttempt(item, false);
    item = recordAttempt(item, true);
    expect(item.solved).toBe(true);
    expect(item.scored).toBe(false);
    expect(feedbackFor(item)).toBe('correct');
  });

  it('ignores attempts once the item is solved', () => {
    const solved = recordAttempt(newItem(), true);
    expect(recordAttempt(solved, false)).toEqual(solved);
  });

  it('never changes the item it is given', () => {
    const item = newItem();
    recordAttempt(item, false);
    expect(item).toEqual(newItem());
  });

  it('respects a different number of rungs in the config', () => {
    const config = { ...CONFIG, hintRungs: 2 };
    let item = recordAttempt(newItem(), false, config);
    item = recordAttempt(item, false, config);
    expect(item.rung).toBe(2);
    expect(feedbackFor(item, config)).toBe('solution');
    expect(recordAttempt(item, true, config).scored).toBe(false);
  });
});
