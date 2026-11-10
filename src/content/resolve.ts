/**
  The resolver: turns a lesson item from the JSON into a ready-to-show
  question for one retake. It builds the tree with that retake's keys, asks
  the engine for every answer, fills the text, works out the rung-2
  highlights and attaches the worked solution.
 
  Every key written in an item (in text as `{50}`, in a task, a written
  answer or a written highlight) is a retake-0 key and is shifted here.
  Values the resolver works out, such as `path`, are already in the
  retake's keys.
 */
import { height, preorder, search, searchSteps, size, subtree } from '../engine';
import type { Highlight, SearchResult, Step, Tree } from '../engine';
import { CONFIG, offsetFor } from './config';
import { fillText } from './placeholders';
import type { PlaceholderValue } from './placeholders';
import type {
  HighlightPreset,
  HintSpec,
  ItemSpec,
  LessonId,
  Part,
  PartSpec,
  Question,
} from './schema';
import { TREES, getTree } from './trees';

type Values = Record<string, PlaceholderValue>;

// Everything one retake of an item needs while it is being resolved. 
interface Context {
  item: ItemSpec;
  retake: number;
  offset: number;
  tree: Tree;
  // Every key in the tree, for checking written keys. 
  keys: ReadonlySet<number>;
  // The task's key, shifted, if it has one. 
  key?: number;
}

// What a task works out: values for the text, its default parts, and the worked solution. 
interface Worked {
  values: Values;
  parts: Part[] | null;
  solution: Step[];
}

class ItemError extends Error {}

function fail(context: Pick<Context, 'item'>, message: string): never {
  throw new ItemError(`Item "${context.item.id}": ${message}`);
}

//  keys 

// Shift a written key for this retake, checking it is whole and stays inside the key range. 
function shiftKey(context: Context, key: number, where: string): number {
  if (!Number.isInteger(key)) fail(context, `${where}: ${JSON.stringify(key)} is not a whole-number key`);
  const shifted = key + context.offset;
  const [lo, hi] = CONFIG.keyRange;
  if (shifted < lo || shifted > hi) {
    fail(context, `${where}: key ${key} becomes ${shifted} on retake ${context.retake}, outside ${lo} to ${hi}`);
  }
  return shifted;
}

// Shift a written key that must name a node in the tree. 
function shiftNode(context: Context, key: number, where: string): number {
  const shifted = shiftKey(context, key, where);
  if (!context.keys.has(shifted)) fail(context, `${where}: key ${key} is not in tree "${context.item.tree}"`);
  return shifted;
}

//  tasks 

function searchValues(key: number, result: SearchResult): Values {
  const values: Values = {
    key,
    path: result.path,
    visits: result.path.length,
    result: result.found ? 'found' : 'not found',
  };
  if (result.endAt !== null && result.side !== null) {
    values.endAt = result.endAt;
    values.side = result.side;
  }
  return values;
}

function work(context: Context): Worked {
  const { item, tree } = context;
  const ask = item.ask;

  switch (ask.kind) {
    case 'searchPath': {
      const key = shiftKey(context, ask.key, 'the task key');
      context.key = key;
      const result = search(tree, key);
      return {
        values: searchValues(key, result),
        parts: [
          { type: 'click', label: 'Path', mode: 'path', answer: [...result.path] },
          { type: 'pick', label: 'Result', options: ['Found', 'Not found'], answer: result.found ? 0 : 1 },
        ],
        solution: searchSteps(tree, key),
      };
    }

    case 'searchEnd': {
      const key = shiftKey(context, ask.key, 'the task key');
      context.key = key;
      const result = search(tree, key);
      if (result.found || result.endAt === null) {
        fail(context, `searchEnd needs a key that is not in the tree, but ${ask.key} is in it`);
      }
      return {
        values: searchValues(key, result),
        parts: [
          { type: 'click', label: 'The node', mode: 'one', answer: result.endAt },
          {
            type: 'pick',
            label: 'Which side of it is empty?',
            options: ['Left', 'Right'],
            answer: result.side === 'left' ? 0 : 1,
          },
        ],
        solution: searchSteps(tree, key),
      };
    }

    case 'maxVisits': {
      const h = height(tree);
      const most = h + 1;
      const n = size(tree);
      // The height (counting edges, not nodes), one too many, and "a search checks every node".
      const options = [...new Set([h, most, h + 2, n])].sort((a, b) => a - b);
      return {
        values: { height: h, most, size: n },
        parts: [{ type: 'pick', label: '', options: options.map(String), answer: options.indexOf(most) }],
        solution: [],
      };
    }

    case 'fixed':
      return { values: {}, parts: null, solution: [] };

    default:
      return fail(context, `there is no kind of task "${(ask as { kind: unknown }).kind}"`);
  }
}

//  text 

function fill(context: Context, values: Values, template: string, where: string): string {
  try {
    return fillText(template, context.offset, values);
  } catch (error) {
    return fail(context, `${where}: ${(error as Error).message}`);
  }
}

//  parts 

// A small seeded random number generator (mulberry32), so a shuffle is the same every time. 
function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    state = Math.imul(state ^ seed.charCodeAt(i), 16777619); // FNV-1a hash of the seed
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shuffle options the same way every time for this item, retake and part, keeping track of the answer. 
function shuffle(context: Context, partIndex: number, options: string[], answer: number) {
  const random = seededRandom(`${context.item.id}#${context.retake}#${partIndex}`);
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  return { options: order.map((i) => options[i] as string), answer: order.indexOf(answer) };
}

function clickAnswer(context: Context, values: Values, spec: Extract<PartSpec, { type: 'click' }>, where: string) {
  const { answer, mode } = spec;

  if (typeof answer === 'string') {
    const value = Object.hasOwn(values, answer) ? values[answer] : undefined;
    if (value === undefined) fail(context, `${where}: this task works out no value called "${answer}"`);
    if (mode === 'one' && typeof value !== 'number') {
      fail(context, `${where}: "${answer}" is not a single key, so it can't answer a click-one part`);
    }
    if (mode !== 'one' && !Array.isArray(value)) {
      fail(context, `${where}: "${answer}" is not a list of keys, so it can't answer a click-${mode} part`);
    }
    return Array.isArray(value) ? [...value] : value;
  }

  if (mode === 'one') {
    if (typeof answer !== 'number') fail(context, `${where}: a click-one answer is one key`);
    return shiftNode(context, answer, where);
  }
  if (!Array.isArray(answer)) fail(context, `${where}: a click-${mode} answer is a list of keys`);
  return answer.map((key) => shiftNode(context, key, where));
}

function buildPart(context: Context, values: Values, spec: PartSpec, index: number): Part {
  const where = `part ${index + 1}`;
  const label = fill(context, values, spec.label ?? '', `${where} label`);

  if (spec.type === 'pick') {
    const options = spec.options.map((option, i) => fill(context, values, option, `${where} option ${i + 1}`));
    if (options.length < 2) fail(context, `${where}: a pick part needs at least two options`);
    if (!Number.isInteger(spec.answer) || spec.answer < 0 || spec.answer >= options.length) {
      fail(context, `${where}: answer ${spec.answer} is not one of its ${options.length} options (they count from 0)`);
    }
    const picked = spec.shuffle ? shuffle(context, index, options, spec.answer) : { options, answer: spec.answer };
    return { type: 'pick', label, ...picked };
  }

  if (spec.type === 'click') {
    const answer = clickAnswer(context, values, spec, where);
    return { type: 'click', label, mode: spec.mode, answer } as Part;
  }

  return fail(context, `${where}: there is no part type "${(spec as { type: unknown }).type}"`);
}

function buildParts(context: Context, worked: Worked): Part[] {
  const specs = context.item.parts;
  let parts: Part[];
  if (specs === undefined) {
    if (worked.parts === null) fail(context, `a "${context.item.ask.kind}" task needs its parts written in the item`);
    parts = worked.parts;
  } else {
    parts = specs.map((spec, index) => buildPart(context, worked.values, spec, index));
  }
  if (parts.length < 1 || parts.length > 3) fail(context, `a question has one to three parts, not ${parts.length}`);
  return parts;
}

//  highlights 

function pathEdges(path: readonly number[]): [number, number][] {
  return path.slice(1).map((key, i) => [path[i] as number, key]);
}

// The leftmost of the longest paths from the root down to a leaf. 
function longestPath(tree: Tree): number[] {
  if (tree === null) return [];
  const left = longestPath(tree.left);
  const right = longestPath(tree.right);
  return [tree.key, ...(right.length > left.length ? right : left)];
}

function presetHighlight(context: Context, preset: HighlightPreset, where: string): Highlight {
  const needKey = (): number => {
    if (context.key === undefined) {
      fail(context, `${where}: the "${preset}" highlight needs a task with a key to search for`);
    }
    return context.key;
  };

  switch (preset) {
    case 'path': {
      const path = search(context.tree, needKey()).path;
      return { visited: path, edges: pathEdges(path) };
    }
    case 'otherHalf': {
      const key = needKey();
      const root = context.tree;
      if (root === null || key === root.key) {
        fail(context, `${where}: the "otherHalf" highlight needs a key other than the root's`);
      }
      const half = key < root.key ? root.right : root.left;
      if (half === null) fail(context, `${where}: the "otherHalf" highlight has nothing to dim`);
      return { dimmed: preorder(half) };
    }
    case 'emptySpot': {
      const result = search(context.tree, needKey());
      if (result.found) fail(context, `${where}: the "emptySpot" highlight needs a key that is not in the tree`);
      return { slot: { parent: result.endAt, side: result.side } };
    }
    case 'longestPath':
      return { edges: pathEdges(longestPath(context.tree)) };
    default:
      return fail(context, `${where}: there is no highlight preset "${preset as string}"`);
  }
}

// Shift every key in a written highlight, checking each one names a node in the tree. 
function shiftHighlight(context: Context, written: Highlight, where: string): Highlight {
  const node = (key: number) => shiftNode(context, key, where);
  const nodes = (keys: readonly number[]) => keys.map(node);
  const out: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(written)) {
    switch (field) {
      case 'visited':
      case 'outlined':
      case 'dimmed':
      case 'output':
        out[field] = nodes(value as number[]);
        break;
      case 'current':
      case 'found':
      case 'offender':
      case 'ghost':
        out[field] = node(value as number);
        break;
      case 'edges':
        out[field] = (value as [number, number][]).map(([parent, child]) => [node(parent), node(child)]);
        break;
      case 'tags':
        out[field] = Object.fromEntries(
          Object.entries(value as Record<string, string>).map(([key, tag]) => [node(Number(key)), tag]),
        );
        break;
      case 'relabel':
        // The new label is a key being copied in, so it need not be a node of its own.
        out[field] = Object.fromEntries(
          Object.entries(value as Record<string, number>).map(([from, to]) => [
            node(Number(from)),
            shiftKey(context, to, where),
          ]),
        );
        break;
      case 'marker': {
        const marker = value as { key: number; position: string };
        out[field] = { key: node(marker.key), position: marker.position };
        break;
      }
      case 'slot': {
        const slot = value as { parent: number; side: 'left' | 'right' };
        const parent = node(slot.parent);
        const below = subtree(context.tree, parent);
        if (below === null || below[slot.side] !== null) {
          fail(context, `${where}: the ${slot.side} side of ${slot.parent} is not an empty spot`);
        }
        out[field] = { parent, side: slot.side };
        break;
      }
      case 'dots':
        out[field] = value;
        break;
      default:
        fail(context, `${where}: a highlight has no field "${field}"`);
    }
  }
  return out as Highlight;
}

function buildHint(context: Context, values: Values, spec: HintSpec, index: number) {
  const where = `hint ${index + 1}`;
  const text = fill(context, values, spec.text, where);
  if (spec.highlight === undefined) return { text };
  const highlight =
    typeof spec.highlight === 'string'
      ? presetHighlight(context, spec.highlight, where)
      : shiftHighlight(context, spec.highlight, where);
  return { text, highlight };
}

//  freezing 

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

//  the resolver 

// Resolve one item for a retake (0 is the original keys). Throws an Error naming the item if anything in it is wrong. 
export function resolveItem(item: ItemSpec, lesson: LessonId, retake = 0): Question {
  const offset = offsetFor(retake); // throws a RangeError for a bad retake number
  if (!Object.hasOwn(TREES, item.tree)) {
    fail({ item }, `there is no tree "${item.tree}" (the trees are ${Object.keys(TREES).join(', ')})`);
  }
  const tree = getTree(item.tree, retake);
  const context: Context = { item, retake, offset, tree, keys: new Set(preorder(tree)) };

  const worked = work(context);
  const { values } = worked;
  const parts = buildParts(context, worked);
  const hints = item.hints.map((hint, index) => buildHint(context, values, hint, index));

  const question: Question = {
    id: item.id,
    lesson,
    outcome: item.outcome,
    retake,
    ...(item.intro === undefined ? {} : { intro: fill(context, values, item.intro, 'intro') }),
    prompt: fill(context, values, item.prompt, 'prompt'),
    tree,
    parts,
    hints,
    explanation: fill(context, values, item.explanation, 'explanation'),
    solution: worked.solution,
    ...(item.misconception === undefined
      ? {}
      : { misconception: fill(context, values, item.misconception, 'misconception') }),
  };
  return deepFreeze(question);
}