
//  Checking a student's answers against a resolved question.
 
import type { Slot } from '../engine';
import { CONFIG } from './config';
import type { ContentConfig, Part, Question } from './schema';

/**
  A student's answer to one part:
  - pick: the index of the chosen option
  - click one: the key clicked
  - click set / click path / order: the keys, in the order given
  - place: the empty spot chosen for each key, in order
 */
export type PartResponse = number | readonly number[] | readonly Slot[];

export interface CheckResult {
  correct: boolean;
  // Click path, order and place: true while every entry given so far is right, so a guided screen can confirm one step at a time.
   
  onTrack?: boolean;
  //* Click path, order and place, when not correct: the index of the first wrong entry, or of the first missing one if every entry so far is right.

  firstWrong?: number;
  // Click set: right keys that were not chosen. 
  missing?: number[];
  // Click set: chosen keys that are not right. 
  extra?: number[];
}

function isKeyList(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every(Number.isInteger);
}

function isSlot(value: unknown): value is Slot {
  if (typeof value !== 'object' || value === null) return false;
  const { parent, side } = value as Record<string, unknown>;
  if (parent === null) return side === null; // the root of an empty tree
  return Number.isInteger(parent) && (side === 'left' || side === 'right');
}

function sameSlot(a: Slot, b: Slot): boolean {
  return a.parent === b.parent && a.side === b.side;
}

// Compare a sequence entry by entry: right, on track so far, or where it first goes wrong.
function checkSequence<T>(answer: readonly T[], response: readonly T[], same: (a: T, b: T) => boolean): CheckResult {
  const shared = Math.min(answer.length, response.length);
  let firstWrong = shared;
  for (let i = 0; i < shared; i++) {
    if (!same(answer[i] as T, response[i] as T)) {
      firstWrong = i;
      break;
    }
  }
  const onTrack = firstWrong === response.length; // every entry given so far is right
  if (onTrack && response.length === answer.length) return { correct: true, onTrack: true };
  return { correct: false, onTrack, firstWrong };
}

function wrongKind(part: Part, expected: string): never {
  const name = part.type === 'click' ? `click-${part.mode}` : part.type;
  throw new TypeError(`A ${name} part needs ${expected} as its response`);
}

function check(part: Part, response: PartResponse): CheckResult {
  switch (part.type) {
    case 'pick': {
      if (!Number.isInteger(response) || (response as number) < 0 || (response as number) >= part.options.length) {
        wrongKind(part, `an option index from 0 to ${part.options.length - 1}`);
      }
      return { correct: response === part.answer };
    }

    case 'click': {
      if (part.mode === 'one') {
        if (!Number.isInteger(response)) wrongKind(part, 'one key');
        return { correct: response === part.answer };
      }
      if (!isKeyList(response)) wrongKind(part, 'a list of keys');
      if (part.mode === 'path') return checkSequence(part.answer, response, (a, b) => a === b);

      // A set: any order, and a key clicked twice counts once.
      const chosen = new Set(response);
      const right = new Set(part.answer);
      const missing = part.answer.filter((key) => !chosen.has(key));
      const extra = [...chosen].filter((key) => !right.has(key));
      return { correct: missing.length === 0 && extra.length === 0, missing, extra };
    }

    case 'order':
      if (!isKeyList(response)) wrongKind(part, 'a list of keys');
      return checkSequence(part.answer, response, (a, b) => a === b);

    case 'place':
      if (!Array.isArray(response) || !response.every(isSlot)) {
        wrongKind(part, 'a list of empty spots, each { parent, side }');
      }
      return checkSequence(part.answer, response as readonly Slot[], sameSlot);

    default:
      throw new TypeError(`There is no part type "${(part as { type: unknown }).type}"`);
  }
}

// Check one part. Throws a TypeError if the response is the wrong kind for the part.
export function checkPart(part: Part, response: PartResponse): CheckResult {
  const result = check(part, response);
  if (result.missing) Object.freeze(result.missing);
  if (result.extra) Object.freeze(result.extra);
  return Object.freeze(result);
}

// Check every part of a question; the question is correct when every part is.
export function checkQuestion(
  question: Question,
  responses: readonly PartResponse[],
): { correct: boolean; parts: CheckResult[] } {
  if (!Array.isArray(responses) || responses.length !== question.parts.length) {
    throw new TypeError(`Question "${question.id}" has ${question.parts.length} parts, so it needs one response for each`);
  }
  const parts = question.parts.map((part, i) => checkPart(part, responses[i] as PartResponse));
  return Object.freeze({ correct: parts.every((result) => result.correct), parts: Object.freeze(parts) as CheckResult[] });
}

//Whether a correct answer counts towards the pass mark, given how many hint rungs were shown first. The last rung is the worked solution.

export function countsAsCorrect(correct: boolean, rungsShown: number, config: ContentConfig = CONFIG): boolean {
  if (!Number.isInteger(rungsShown) || rungsShown < 0 || rungsShown > config.hintRungs) {
    throw new RangeError(`rungsShown must be a whole number from 0 to ${config.hintRungs}, but got ${rungsShown}`);
  }
  const sawSolution = rungsShown === config.hintRungs;
  return correct && (!sawSolution || config.countCorrectAfterSolution);
}