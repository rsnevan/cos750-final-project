/**
  The final test (`data/final.json`): ten items on tree U, no hints, and the
  rules for the results screen.
 
  - An outcome is secure when every item for it is right; otherwise the
    screen says "Listen for this in the lecture".
  - The overall descriptor is the first whose `min` the score reaches and
    whose `requires` items are all right (the ID document's Excellent band
    needs the two-children delete).
  - The lecture question is the one for the first outcome that is not secure,
    or the last outcome's if every outcome is secure.
 */
import {
  ShapeError,
  bad,
  deepFreeze,
  list,
  literal,
  object,
  plainText,
  positiveInt,
  int,
  refine,
  text,
  type Check,
} from './checks';
import raw from './data/final.json';
import { LESSON_SPECS } from './lessons';
import { resolveItem } from './resolve';
import type { ItemSpec, Outcome, Question } from './schema';
import { item } from './validateLesson';

export interface FinalTestSpec {
  title: string;
  minutes: number;
  // One line for the lesson list and the start screen. 
  summary: string;
  // Shown above every question. 
  banner: string;
  // Shown on the first attempt. 
  firstNote: string;
  // Shown on a retake. 
  retakeNote: string;
  // In the order the results screen lists them. 
  outcomes: { id: Outcome; name: string; lectureQuestion: string }[];
  // From highest to lowest; the last has `min` 0 and no `requires`. 
  descriptors: { name: string; min: number; meaning: string; requires?: string[] }[];
  items: ItemSpec[];
}

export interface FinalResults {
  score: number;
  total: number;
  outcomes: { id: Outcome; name: string; secure: boolean }[];
  descriptor: { name: string; meaning: string };
  lectureQuestion: string;
}

const OUTCOME_IDS = ['LO1', 'LO2', 'LO3', 'LO4', 'LO5', 'LO6'];

const finalItem: Check = refine(item, (value: ItemSpec, path) => {
  if (value.hints.length > 0) bad(`${path}.hints`, 'must be empty: the final test has no hints');
});

const file = object({
  title: plainText,
  minutes: positiveInt,
  summary: plainText,
  banner: plainText,
  firstNote: plainText,
  retakeNote: plainText,
  outcomes: list(object({ id: literal(...OUTCOME_IDS), name: plainText, lectureQuestion: plainText }), { min: 1 }),
  descriptors: list(
    object({ name: plainText, min: int, meaning: plainText }, { requires: list(text, { min: 1 }) }),
    { min: 1 },
  ),
  items: list(finalItem, { min: 1 }),
});

// Check the final test file, throwing an Error naming the first problem and where it is. 
export function validateFinal(input: unknown, name = 'final.json'): FinalTestSpec {
  try {
    const spec = file(input, '') as FinalTestSpec;

    const outcomeIds = spec.outcomes.map((outcome) => outcome.id);
    if (new Set(outcomeIds).size !== outcomeIds.length) bad('outcomes', 'must not repeat an outcome');

    const ids = new Set<string>();
    spec.items.forEach((entry, i) => {
      if (ids.has(entry.id)) bad(`items[${i}].id`, `repeats the id "${entry.id}"`);
      ids.add(entry.id);
      if (!outcomeIds.includes(entry.outcome)) {
        bad(`items[${i}].outcome`, `is ${entry.outcome}, which is not in "outcomes"`);
      }
    });
    for (const id of outcomeIds) {
      if (!spec.items.some((entry) => entry.outcome === id)) bad('outcomes', `lists ${id}, but no item assesses it`);
    }

    spec.descriptors.forEach((descriptor, i) => {
      const path = `descriptors[${i}]`;
      if (descriptor.min < 0 || descriptor.min > spec.items.length) {
        bad(`${path}.min`, `must be from 0 to ${spec.items.length}, the number of items`);
      }
      if (i > 0 && descriptor.min >= (spec.descriptors[i - 1] as { min: number }).min) {
        bad(`${path}.min`, 'must be lower than the one before: descriptors go from highest to lowest');
      }
      for (const id of descriptor.requires ?? []) {
        if (!ids.has(id)) bad(`${path}.requires`, `names "${id}", which is not an item`);
      }
    });
    const last = spec.descriptors.at(-1);
    if (last?.min !== 0 || last.requires !== undefined) {
      bad('descriptors', 'must end with one that has min 0 and no "requires", so every score gets a descriptor');
    }

    return deepFreeze(spec);
  } catch (error) {
    if (error instanceof ShapeError) throw new Error(`${name}: ${error.message}`);
    throw error;
  }
}

function load(): FinalTestSpec {
  const spec = validateFinal(raw);
  const lessonIds = new Set(Object.values(LESSON_SPECS).flatMap((lesson) => lesson.activity.items.map((i) => i.id)));
  for (const entry of spec.items) {
    if (lessonIds.has(entry.id)) throw new Error(`final.json: item id "${entry.id}" is also used in a lesson`);
  }
  return spec;
}

// The final test file, checked when the content module loads. 
export const FINAL_TEST = load();

// The final test's questions for a retake (0 is the original keys), in order. 
export function finalQuestions(retake = 0): Question[] {
  return FINAL_TEST.items.map((entry) => resolveItem(entry, 'final', retake));
}

// The results screen, from whether each item was answered right, keyed by  item id. Throws a TypeError unless every item has exactly one true or false.
 
export function finalResults(correct: Readonly<Record<string, boolean>>, spec: FinalTestSpec = FINAL_TEST): FinalResults {
  const ids = spec.items.map((entry) => entry.id);
  for (const id of ids) {
    if (typeof correct[id] !== 'boolean') throw new TypeError(`finalResults needs true or false for item "${id}"`);
  }
  for (const id of Object.keys(correct)) {
    if (!ids.includes(id)) throw new TypeError(`finalResults was given "${id}", which is not a final test item`);
  }

  const score = ids.filter((id) => correct[id]).length;
  const outcomes = spec.outcomes.map(({ id, name }) => ({
    id,
    name,
    secure: spec.items.filter((entry) => entry.outcome === id).every((entry) => correct[entry.id]),
  }));
  const descriptor = spec.descriptors.find(
    (d) => score >= d.min && (d.requires ?? []).every((id) => correct[id]),
  ) as FinalTestSpec['descriptors'][number];
  const weakest = outcomes.find((outcome) => !outcome.secure)?.id ?? spec.outcomes.at(-1)?.id;

  return deepFreeze({
    score,
    total: ids.length,
    outcomes,
    descriptor: { name: descriptor.name, meaning: descriptor.meaning },
    lectureQuestion: spec.outcomes.find((outcome) => outcome.id === weakest)?.lectureQuestion ?? '',
  });
}