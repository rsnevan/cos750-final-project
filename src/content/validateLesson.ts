/**
  Checking a lesson file's structure when it loads, so a typo in the JSON
  fails a test with the exact place ("lesson3.json: activity.items[2].ask.key
  must be a whole number") instead of breaking a screen.
 
  This checks shape only. Whether the content is right (trees exist, keys are
  in them, answers work on every retake) is checked by `resolveLesson` and
  `resolveItem`, which the content tests run on every lesson.
 */
import {
  ShapeError,
  answerInRange,
  bad,
  bool,
  deepFreeze,
  int,
  intList,
  keyedByNode,
  kinded,
  list,
  literal,
  nullable,
  object,
  plainText,
  positiveInt,
  refine,
  shape,
  text,
  tuple,
  type Check,
} from './checks';
import type { LessonSpec } from './lessonSchema';

const OUTCOMES = ['LO1', 'LO2', 'LO3', 'LO4', 'LO5', 'LO6'];
const ORDERS = literal('pre', 'in', 'post');
const SIDES = literal('left', 'right');
const PRESETS = [
  'path',
  'otherHalf',
  'emptySpot',
  'longestPath',
  'leaves',
  'depthHeight',
  'extremePaths',
  'outsideSubtree',
  'dots',
  'children',
  'rightSubtree',
];

// ---------- shared pieces ----------

const name: Check = (value, path) => {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) bad(path, 'must be a tree name such as "T"');
  return value;
};

const treeRef: Check = (value, path) =>
  typeof value === 'string'
    ? name(value, path)
    : object({ from: name }, { insert: intList({ min: 1 }), delete: intList({ min: 1 }) })(value, path);

// A written highlight. `label` checks the text in tags and labels: plain for stages, placeholders allowed in items. //
function highlight(label: Check): Check {
  return object(
    {},
    {
      visited: intList(),
      current: int,
      found: int,
      offender: int,
      outlined: intList(),
      dimmed: intList(),
      edges: list(tuple(int, int)),
      tags: keyedByNode(label),
      slot: object({ parent: int, side: SIDES }),
      dots: literal('pre', 'in', 'post', 'all'),
      marker: object({ key: int, position: ORDERS }),
      output: intList(),
      relabel: keyedByNode(int),
      ghost: int,
      slotLabel: label,
      edgeLabels: list(tuple(int, int, label)),
    },
  );
}

const presetOr = (written: Check): Check => (value, path) =>
  typeof value === 'string' ? literal(...PRESETS)(value, path) : written(value, path);

const choiceOption = object({ text: plainText, reply: plainText });

// ---------- activity items ----------

const deleteResult = refine(object({ options: list(text, { min: 2 }), answer: int }), answerInRange);

const ask = kinded('kind', {
  rootAndLeaves: object({}, { withHeight: bool }),
  depthHeight: object({}, { depthOf: int, heightOf: int }),
  validity: object({}),
  searchPath: object({ key: int }),
  searchEnd: object({ key: int }),
  maxVisits: object({}),
  insertSlot: object({ key: int }),
  build: object({ keys: intList({ min: 1 }) }),
  minMax: object({ find: list(literal('min', 'max'), { min: 1, max: 2 }) }, { from: int }),
  traversal: object({ order: ORDERS }, { from: int }),
  delete: object({ key: int, result: deleteResult }, { successor: bool }),
  successor: object({ key: int }),
  fixed: object({}),
});

const clickAnswer: Check = (value, path) => {
  if (typeof value === 'string') return text(value, path); // the name of a worked-out value
  if (Array.isArray(value)) return intList({ min: 1 })(value, path);
  return int(value, path);
};

const part = kinded('type', {
  pick: refine(object({ options: list(text, { min: 2 }), answer: int }, { label: text, shuffle: bool }), answerInRange),
  click: object({ mode: literal('one', 'set', 'path'), answer: clickAnswer }, { label: text }),
});

const itemHighlight = presetOr(highlight(text));

// One activity item. Exported for the final test, whose items have the same shape. //
export const item = object(
  {
    id: (value, path) => {
      if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(value)) {
        bad(path, 'must be lowercase letters, digits and dashes, such as "l2-search-20"');
      }
      return value;
    },
    outcome: literal(...OUTCOMES),
    ask,
    prompt: text,
    hints: list(object({ text }, { highlight: itemHighlight }), { max: 2 }),
    explanation: text,
  },
  {
    tree: treeRef,
    base: itemHighlight,
    intro: text,
    parts: list(part, { min: 1, max: 3 }),
    misconception: text,
    bridge: text,
  },
);

// ---------- stages ----------

const diagram = object({ tree: treeRef }, { highlight: highlight(plainText) });

const hook = object(
  {
    goal: plainText,
    scenario: object({ title: plainText, text: plainText }, { recall: plainText, reveal: plainText }),
    warmUp: refine(
      object({ question: plainText, options: list(choiceOption, { min: 2 }), answer: int }, { tree: treeRef }),
      answerInRange,
    ),
  },
  { bridge: plainText },
);

const deleteTryResult: Check = (value, path) => {
  if (value === null || value === 'delete') return value;
  return object({ shape })(value, path);
};

const explore = kinded('kind', {
  relatives: object({ tree: treeRef, need: positiveInt }),
  pickTree: refine(
    object({
      prompt: plainText,
      trees: list(object({ label: plainText, tree: treeRef }), { min: 2 }),
      answer: int,
      reveal: plainText,
    }),
    (value, path) => answerInRange({ options: value.trees, answer: value.answer }, path),
  ),
  freeSearch: object({ tree: treeRef, key: int }),
  slotProbe: object({ tree: treeRef, key: int }),
  walk: object({ tree: treeRef }),
  orderGuess: object({ tree: treeRef, order: ORDERS }),
  deleteTry: object({
    cases: list(
      object(
        {
          label: plainText,
          tree: treeRef,
          key: int,
          options: list(object({ text: plainText, result: deleteTryResult }), { min: 2 }),
        },
        { note: plainText },
      ),
      { min: 1 },
    ),
  }),
  reflect: refine(
    object({ prompt: plainText, options: list(choiceOption, { min: 2 }), answer: nullable(int) }),
    answerInRange,
  ),
});

const PSEUDOCODE_NAMES = literal('search', 'insert', 'traverse', 'delete');

const explainPage = object(
  { title: plainText },
  {
    terms: list(
      object({ group: plainText, items: list(object({ term: plainText, meaning: plainText }), { min: 1 }) }),
      { min: 1 },
    ),
    steps: list(plainText, { min: 1 }),
    note: plainText,
    diagram,
    caption: plainText,
    pseudocode: PSEUDOCODE_NAMES,
  },
);

const BUILDERS: Record<string, Check> = {
  search: object({ tree: treeRef, key: int }),
  insert: object({ tree: treeRef, key: int }),
  build: intList({ min: 1 }),
  extreme: object({ tree: treeRef, which: literal('min', 'max') }, { from: int }),
  traversal: object({ tree: treeRef, order: ORDERS }, { from: int }),
  walk: object({ tree: treeRef }),
  delete: object({ tree: treeRef, key: int }),
};

// One engine builder (`{ "search": { ... } }`), or a written step (`{ "tree", "text", "highlight" }`). //
const stepSpec: Check = (value, path) => {
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return object({ tree: treeRef, text: plainText }, { highlight: highlight(plainText) })(value, path);
  }
  const fields = typeof value === 'object' && value !== null ? Object.keys(value) : [];
  const builder = fields.length === 1 ? (fields[0] as string) : '';
  const check = Object.hasOwn(BUILDERS, builder) ? BUILDERS[builder] : undefined;
  if (check === undefined) {
    bad(path, `must have exactly one of ${Object.keys(BUILDERS).join(', ')}, or be a written step with tree and text`);
  }
  return { [builder]: check((value as Record<string, unknown>)[builder], `${path}.${builder}`) };
};

const workedExample = object(
  { label: plainText, steps: list(stepSpec, { min: 1 }) },
  { deleteCase: literal('leaf', 'one', 'two'), pseudocode: PSEUDOCODE_NAMES },
);

const nodeFact: Check = (value, path) => {
  if (value === 'root' || value === 'leaves') return value;
  if (Array.isArray(value)) return intList({ min: 1 })(value, path);
  if (typeof value === 'object' && value !== null) {
    return 'parentOf' in value ? object({ parentOf: int })(value, path) : object({ successorOf: int })(value, path);
  }
  return bad(path, 'must be "root", "leaves", { "parentOf": key }, { "successorOf": key } or a list of keys');
};

const guidedStep = kinded('ask', {
  node: object(
    { prompt: plainText, answer: nodeFact, right: plainText, wrong: plainText },
    { tag: plainText, highlight: highlight(plainText) },
  ),
  choice: refine(
    object(
      { prompt: plainText, options: list(plainText, { min: 2 }), answer: int, right: plainText, wrong: plainText },
      { highlight: highlight(plainText), showRange: bool, after: diagram },
    ),
    answerInRange,
  ),
});

const tryIt = kinded('kind', {
  search: object({ title: plainText, tree: treeRef, key: int }),
  insert: object({ title: plainText, tree: treeRef, key: int }),
  traversal: object({ title: plainText, tree: treeRef, order: ORDERS }, { from: int }),
  guided: object({ title: plainText, tree: treeRef, steps: list(guidedStep, { min: 1 }) }),
});

const lesson = object({
  lesson: literal(1, 2, 3, 4, 5),
  title: plainText,
  short: plainText,
  minutes: positiveInt,
  outcomes: refine(list(literal(...OUTCOMES), { min: 1 }), (value: string[], path) => {
    if (new Set(value).size !== value.length) bad(path, 'must not repeat an outcome');
  }),
  summary: plainText,
  hook,
  explore: list(explore, { min: 1 }),
  explain: object({ pages: list(explainPage, { min: 1 }) }),
  worked: object({ examples: list(workedExample, { min: 1 }) }),
  tryIt,
  activity: object({ title: plainText, items: list(item, { min: 1 }) }),
});

// Check a lesson file's structure, throwing an Error naming the first problem and where it is. //
export function validateLesson(raw: unknown, file = 'lesson'): LessonSpec {
  try {
    const spec = lesson(raw, '') as LessonSpec;
    const ids = new Set<string>();
    spec.activity.items.forEach((entry, i) => {
      if (ids.has(entry.id)) bad(`activity.items[${i}].id`, `repeats the id "${entry.id}"`);
      ids.add(entry.id);
      if (!spec.outcomes.includes(entry.outcome)) {
        bad(`activity.items[${i}].outcome`, `is ${entry.outcome}, which is not one of this lesson's outcomes`);
      }
    });
    return deepFreeze(spec);
  } catch (error) {
    if (error instanceof ShapeError) throw new Error(`${file}: ${error.message}`);
    throw error;
  }
}