import { describe, expect, it } from 'vitest';
import { fillText } from '../../src/content';

describe('fillText: keys', () => {
  it('leaves a key unchanged on the first attempt', () => {
    expect(fillText('Search for {65}.', 0)).toBe('Search for 65.');
  });

  it('shifts a key by the retake offset, up or down', () => {
    expect(fillText('Search for {65}.', 7)).toBe('Search for 72.');
    expect(fillText('Search for {65}.', -7)).toBe('Search for 58.');
  });

  it('shifts every key, including repeats', () => {
    expect(fillText('Start at {50}: {65} > {50}, go right.', 13)).toBe(
      'Start at 63: 78 > 63, go right.',
    );
  });

  it('leaves plain numbers alone, so counts and lesson numbers are not shifted', () => {
    expect(fillText('Lesson 2 takes 3 comparisons to reach {40}.', 7)).toBe(
      'Lesson 2 takes 3 comparisons to reach 47.',
    );
  });

  it('rejects an offset that is not a whole number', () => {
    expect(() => fillText('{50}', 0.5)).toThrow(RangeError);
  });
});

describe('fillText: named values', () => {
  it('fills a number or a string as written', () => {
    expect(fillText('It took {count} steps; the case is {kind}.', 0, { count: 3, kind: 'leaf' })).toBe(
      'It took 3 steps; the case is leaf.',
    );
  });

  it('joins a list of keys with commas', () => {
    expect(fillText('The path is {path}.', 0, { path: [50, 30, 40] })).toBe(
      'The path is 50, 30, 40.',
    );
  });

  it('does not shift named values, which the resolver has already worked out for this retake', () => {
    expect(fillText('{50} then {next}', 7, { next: 67, path: [57] })).toBe('57 then 67');
  });

  it('allows values that the text does not use', () => {
    expect(fillText('Plain text.', 0, { path: [1, 2] })).toBe('Plain text.');
  });

  it('rejects a named placeholder with no value, naming it', () => {
    expect(() => fillText('The successor is {successor}.', 0)).toThrow(/successor/);
  });
});

describe('fillText: mistakes in the text', () => {
  it('leaves text with no placeholders unchanged', () => {
    expect(fillText('', 7)).toBe('');
    expect(fillText('Smaller keys go left.', 7)).toBe('Smaller keys go left.');
  });

  it.each(['{50', '50}', '{ 50 }', '{}', '{5a}', '{-5}', '{{50}}', '{path.length}'])(
    'rejects the stray or malformed braces in %s',
    (template) => {
      expect(() => fillText(template, 0, { path: [1] })).toThrow();
    },
  );
});