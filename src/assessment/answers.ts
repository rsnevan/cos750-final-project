/**
  Answer checking for the question types in the activities and final test
  (lesson plan handoff: one reusable question component with four answer
  types: pick an option, click a node, drag cards into order, place a key
  on a slot).

  "Click a node" comes in three forms (one node, a set in any order, a path
  in order), and "build a tree" is a run of slot placements.

  A question is a list of parts; the student gives one response per part.
  PROVISIONAL: this part format still has to be agreed with the content
  format in the engine role, and may change.
 */
import { sameTree, type Slot, type Tree } from '../engine';

interface PartBase {
  // Optional parts may be left blank before pressing Check, but still count when marking.
  readonly optional?: boolean;
}

export type Part = PartBase &
  (
    | { readonly type: 'pick'; readonly options: readonly string[]; readonly answer: number } // index into options
    | { readonly type: 'clickOne'; readonly answer: number } // node key
    | { readonly type: 'clickSet'; readonly answer: readonly number[] } // node keys, any order
    | { readonly type: 'clickPath'; readonly answer: readonly number[] } // node keys, in order
    | { readonly type: 'order'; readonly cards: readonly number[]; readonly answer: readonly number[] }
    | { readonly type: 'slot'; readonly answer: Slot }
    | { readonly type: 'build'; readonly keys: readonly number[]; readonly answer: Tree }
  );

export type PartType = Part['type'];

export type Response =
  | { readonly type: 'pick'; readonly choice: number | null }
  | { readonly type: 'clickOne'; readonly node: number | null }
  | { readonly type: 'clickSet'; readonly nodes: readonly number[] }
  | { readonly type: 'clickPath'; readonly nodes: readonly number[] }
  | { readonly type: 'order'; readonly cards: readonly number[] }
  | { readonly type: 'slot'; readonly slot: Slot | null }
  | { readonly type: 'build'; readonly placed: readonly number[]; readonly tree: Tree };

type ResponseFor<T extends PartType> = Extract<Response, { type: T }>;
type PartFor<T extends PartType> = Extract<Part, { type: T }>;

export function emptyResponse(part: Part): Response {
  switch (part.type) {
    case 'pick': return { type: 'pick', choice: null };
    case 'clickOne': return { type: 'clickOne', node: null };
    case 'clickSet': return { type: 'clickSet', nodes: [] };
    case 'clickPath': return { type: 'clickPath', nodes: [] };
    case 'order': return { type: 'order', cards: [] };
    case 'slot': return { type: 'slot', slot: null };
    case 'build': return { type: 'build', placed: [], tree: null };
  }
}

// True when the student has given enough to press Check.
export function isComplete(part: Part, response: Response): boolean {
  switch (part.type) {
    case 'pick': return match(part, response).choice !== null;
    case 'clickOne': return match(part, response).node !== null;
    case 'clickSet': return match(part, response).nodes.length > 0;
    case 'clickPath': return match(part, response).nodes.length > 0;
    case 'order': return match(part, response).cards.length === part.cards.length;
    case 'slot': return match(part, response).slot !== null;
    case 'build': return match(part, response).placed.length === part.keys.length;
  }
}

export function isCorrect(part: Part, response: Response): boolean {
  switch (part.type) {
    case 'pick': return match(part, response).choice === part.answer;
    case 'clickOne': return match(part, response).node === part.answer;
    case 'clickSet': return sameList(sorted(match(part, response).nodes), sorted(part.answer));
    case 'clickPath': return sameList(match(part, response).nodes, part.answer);
    case 'order': return sameList(match(part, response).cards, part.answer);
    case 'slot': {
      const slot = match(part, response).slot;
      return slot !== null && slot.parent === part.answer.parent && slot.side === part.answer.side;
    }
    case 'build': {
      const r = match(part, response);
      return r.placed.length === part.keys.length && sameTree(r.tree, part.answer);
    }
  }
}

// Every required part answered, so Check can be pressed.
export function isQuestionComplete(parts: readonly Part[], responses: readonly Response[]): boolean {
  sameLength(parts, responses);
  return parts.every((p, i) => p.optional || isComplete(p, responses[i]!));
}

// Every part correct, optional parts included.
export function isQuestionCorrect(parts: readonly Part[], responses: readonly Response[]): boolean {
  sameLength(parts, responses);
  return parts.every((p, i) => isCorrect(p, responses[i]!));
}

function match<T extends PartType>(part: PartFor<T>, response: Response): ResponseFor<T> {
  if (response.type !== part.type) {
    throw new Error(`A ${part.type} part got a ${response.type} response`);
  }
  return response as ResponseFor<T>;
}

function sameLength(parts: readonly Part[], responses: readonly Response[]): void {
  if (parts.length !== responses.length) {
    throw new Error(`Expected ${parts.length} responses, got ${responses.length}`);
  }
}

const sorted = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);
const sameList = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
