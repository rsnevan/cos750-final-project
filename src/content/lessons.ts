/**
  Lessons: turning a checked lesson file into the ready-to-show lesson the
  screens use, with every tree built and every animation and answer worked
  out by the engine. Stages always use the original keys (retake 0).
 */
import {
  PSEUDOCODE,
  allowedRange,
  buildSteps,
  checkBST,
  deleteSteps,
  extremeSteps,
  fromShape,
  insertSteps,
  leaves,
  parentOf,
  preorder,
  remove,
  search,
  searchSteps,
  subtree,
  successor,
  traversalSteps,
  traverse,
  walkSteps,
} from '../engine';
import type { DeleteCase, Highlight, Shape, Step, Tree } from '../engine';
import { deepFreeze } from './checks';
import { fail, shiftKey, shiftNode, treeFromRef, type Context } from './context';
import { writtenHighlight } from './highlights';
import type {
  Diagram,
  DiagramSpec,
  Explore,
  ExploreSpec,
  GuidedStep,
  GuidedStepSpec,
  Lesson,
  LessonNumber,
  LessonSpec,
  NodeFact,
  Pseudocode,
  PseudocodeName,
  StepSpec,
  TryIt,
  TryItSpec,
  WorkedExampleSpec,
} from './lessonSchema';
import { resolveItem } from './resolve';
import type { ItemSpec, Question, TreeRef } from './schema';
import { validateLesson } from './validateLesson';
import lesson1 from './data/lesson1.json';
import lesson2 from './data/lesson2.json';
import lesson3 from './data/lesson3.json';
import lesson4 from './data/lesson4.json';
import lesson5 from './data/lesson5.json';

// What errors name, such as "Lesson 2 explore 3". 
interface Owner {
  item: ItemSpec;
  label: string;
}

function owner(lesson: number, place: string): Owner {
  const label = `Lesson ${lesson} ${place}`;
  return { item: { id: label } as ItemSpec, label };
}

// A context for checking keys and highlights on a stage tree (offset 0: stages keep the original keys). 
function stageContext(who: Owner, tree: Tree): Context {
  return { ...who, retake: 0, offset: 0, tree, keys: new Set(preorder(tree)) };
}

function tree(who: Owner, ref: TreeRef): Tree {
  return treeFromRef(who, ref, 0, 0);
}

function highlightOn(who: Owner, on: Tree, written: Highlight | undefined, where = 'highlight'): Highlight {
  return written === undefined ? {} : writtenHighlight(stageContext(who, on), {}, written, where);
}

function diagram(who: Owner, spec: DiagramSpec): Diagram {
  const built = tree(who, spec.tree);
  return { tree: built, highlight: highlightOn(who, built, spec.highlight) };
}

function pseudocode(name: PseudocodeName): Pseudocode {
  return { name, lines: PSEUDOCODE[name] };
}

// A node key on a stage tree: must be in it. 
function node(who: Owner, on: Tree, key: number, where: string): number {
  return shiftNode(stageContext(who, on), key, where);
}

// Any key (such as one to search for or insert): must be whole and in the key range. 
function anyKey(who: Owner, on: Tree, key: number, where: string): number {
  return shiftKey(stageContext(who, on), key, where);
}

function from(who: Owner, on: Tree, key: number | undefined): Tree {
  return key === undefined ? on : subtree(on, node(who, on, key, 'from'));
}

//  explore 

// Every key in `tree` except `key`, sorted, for checking a drawn delete result. 
function keysWithout(on: Tree, key: number): string {
  return JSON.stringify(preorder(on).filter((k) => k !== key).sort((a, b) => a - b));
}

function explore(who: Owner, spec: ExploreSpec): Explore {
  switch (spec.kind) {
    case 'relatives':
      return { kind: 'relatives', tree: tree(who, spec.tree), need: spec.need };

    case 'pickTree':
      return { ...spec, trees: spec.trees.map(({ label, tree: ref }) => ({ label, tree: tree(who, ref) })) };

    case 'freeSearch': {
      const on = tree(who, spec.tree);
      const key = anyKey(who, on, spec.key, 'key');
      return { kind: 'freeSearch', tree: on, key, path: search(on, key).path as number[] };
    }

    case 'slotProbe': {
      const on = tree(who, spec.tree);
      const key = anyKey(who, on, spec.key, 'key');
      const result = search(on, key);
      if (result.found) fail(who, `key ${key} is already in the tree, so there is nowhere to place it`);
      return { kind: 'slotProbe', tree: on, key, slot: { parent: result.endAt, side: result.side } };
    }

    case 'walk': {
      const on = tree(who, spec.tree);
      return { kind: 'walk', tree: on, steps: walkSteps(on) };
    }

    case 'orderGuess': {
      const on = tree(who, spec.tree);
      return { kind: 'orderGuess', tree: on, order: spec.order, answer: traverse(on, spec.order) };
    }

    case 'deleteTry':
      return {
        kind: 'deleteTry',
        cases: spec.cases.map((entry, c) => {
          const on = tree(who, entry.tree);
          const key = node(who, on, entry.key, `case ${c + 1} key`);
          const removed = remove(on, key);
          const options = entry.options.map((option, o) => {
            if (option.result === null) return { text: option.text, result: null, valid: false, possible: false };
            let result: Tree;
            if (option.result === 'delete') {
              result = removed.tree;
            } else {
              try {
                result = fromShape(option.result.shape as Shape);
              } catch (error) {
                return fail(who, `case ${c + 1} option ${o + 1}: ${(error as Error).message}`);
              }
              // A drawn move must keep every other key and drop only the one removed.
              if (keysWithout(result, Number.NaN) !== keysWithout(on, key)) {
                fail(who, `case ${c + 1} option ${o + 1}: the drawn tree must hold every key except ${key}`);
              }
            }
            return { text: option.text, result, valid: checkBST(result).valid, possible: true };
          });
          return {
            label: entry.label,
            tree: on,
            key,
            deleteCase: removed.case as DeleteCase,
            options,
            ...(entry.note === undefined ? {} : { note: entry.note }),
          };
        }),
      };

    case 'reflect':
      return { ...spec };
  }
}

//  worked examples 

function steps(who: Owner, spec: StepSpec): Step[] {
  if ('text' in spec) {
    const on = tree(who, spec.tree);
    return [{ tree: on, highlight: highlightOn(who, on, spec.highlight), text: spec.text }];
  }
  if ('build' in spec) return buildSteps(spec.build.map((key) => anyKey(who, null, key, 'build')));
  if ('search' in spec) {
    const on = tree(who, spec.search.tree);
    return searchSteps(on, anyKey(who, on, spec.search.key, 'search key'));
  }
  if ('insert' in spec) {
    const on = tree(who, spec.insert.tree);
    return insertSteps(on, anyKey(who, on, spec.insert.key, 'insert key'));
  }
  if ('extreme' in spec) {
    const on = tree(who, spec.extreme.tree);
    return extremeSteps(from(who, on, spec.extreme.from), spec.extreme.which);
  }
  if ('traversal' in spec) {
    const on = tree(who, spec.traversal.tree);
    return traversalSteps(from(who, on, spec.traversal.from), spec.traversal.order);
  }
  if ('walk' in spec) return walkSteps(tree(who, spec.walk.tree));
  const on = tree(who, spec.delete.tree);
  return deleteSteps(on, node(who, on, spec.delete.key, 'delete key'));
}

function workedExample(who: Owner, spec: WorkedExampleSpec) {
  if (spec.deleteCase !== undefined) {
    const del = spec.steps.find((entry): entry is Extract<StepSpec, { delete: unknown }> => 'delete' in entry);
    if (del === undefined) fail(who, 'deleteCase needs a delete step to check it against');
    const on = tree(who, del.delete.tree);
    const actual = remove(on, node(who, on, del.delete.key, 'delete key')).case;
    if (actual !== spec.deleteCase) {
      fail(who, `the example says "${spec.deleteCase}", but deleting ${del.delete.key} is the "${actual}" case`);
    }
  }
  return {
    label: spec.label,
    ...(spec.deleteCase === undefined ? {} : { deleteCase: spec.deleteCase }),
    ...(spec.pseudocode === undefined ? {} : { pseudocode: pseudocode(spec.pseudocode) }),
    steps: spec.steps.flatMap((entry) => steps(who, entry)),
  };
}

//  try it 

function nodeFact(who: Owner, on: Tree, fact: NodeFact): number[] {
  if (fact === 'root') {
    if (on === null) fail(who, 'an empty tree has no root');
    return [on.key];
  }
  if (fact === 'leaves') return leaves(on);
  if (Array.isArray(fact)) return fact.map((key) => node(who, on, key, 'answer'));
  if ('parentOf' in fact) {
    const parent = parentOf(on, node(who, on, fact.parentOf, 'parentOf'));
    if (parent === null) fail(who, `${fact.parentOf} is the root, so it has no parent`);
    return [parent];
  }
  const next = successor(on, node(who, on, fact.successorOf, 'successorOf'));
  if (next === null) fail(who, `${fact.successorOf} is the largest key, so it has no successor`);
  return [next];
}

// "61 to 69", "61 or more", "up to 29", "any key", or "no key fits". 
function rangeInWords({ lo, hi }: { lo: number | null; hi: number | null }): string {
  if (lo !== null && hi !== null) return lo > hi ? 'no key fits' : `${lo} to ${hi}`;
  if (lo !== null) return `${lo} or more`;
  if (hi !== null) return `up to ${hi}`;
  return 'any key';
}

function guidedStep(lesson: number, on: Tree, spec: GuidedStepSpec, index: number): GuidedStep {
  const who = owner(lesson, `try it step ${index + 1}`);
  const highlight = highlightOn(who, on, spec.highlight);

  if (spec.ask === 'node') {
    return {
      ask: 'node',
      prompt: spec.prompt,
      accept: nodeFact(who, on, spec.answer),
      ...(spec.tag === undefined ? {} : { tag: spec.tag }),
      highlight,
      right: spec.right,
      wrong: spec.wrong,
    };
  }

  let shown = highlight;
  if (spec.showRange) {
    if (highlight.slot === undefined) fail(who, 'showRange needs a highlight with a slot to show the range at');
    shown = { ...highlight, slotLabel: rangeInWords(allowedRange(on, highlight.slot)) };
  }
  return {
    ask: 'choice',
    prompt: spec.prompt,
    options: [...spec.options],
    answer: spec.answer,
    highlight: shown,
    right: spec.right,
    wrong: spec.wrong,
    ...(spec.after === undefined ? {} : { after: diagram(who, spec.after) }),
  };
}

function tryIt(lesson: number, spec: TryItSpec): TryIt {
  const who = owner(lesson, 'try it');
  const on = tree(who, spec.tree);

  switch (spec.kind) {
    case 'search': {
      const key = anyKey(who, on, spec.key, 'key');
      const result = search(on, key);
      return {
        kind: 'search',
        title: spec.title,
        tree: on,
        key,
        path: [...result.path],
        found: result.found,
        solution: searchSteps(on, key),
      };
    }
    case 'insert': {
      const key = anyKey(who, on, spec.key, 'key');
      const result = search(on, key);
      if (result.found) fail(who, `key ${key} is already in the tree, so there is nothing to insert`);
      return {
        kind: 'insert',
        title: spec.title,
        tree: on,
        key,
        path: [...result.path],
        slot: { parent: result.endAt, side: result.side },
        solution: insertSteps(on, key),
      };
    }
    case 'traversal': {
      const start = from(who, on, spec.from);
      return {
        kind: 'traversal',
        title: spec.title,
        tree: on,
        order: spec.order,
        ...(spec.from === undefined ? {} : { from: spec.from }),
        sequence: traverse(start, spec.order),
        solution: traversalSteps(start, spec.order),
      };
    }
    case 'guided':
      return {
        kind: 'guided',
        title: spec.title,
        tree: on,
        steps: spec.steps.map((entry, i) => guidedStep(lesson, on, entry, i)),
      };
  }
}

//  the lesson 

// Build a lesson's stages. Throws an Error naming the stage if anything in it is wrong. 
export function resolveLesson(spec: LessonSpec): Lesson {
  const n = spec.lesson;
  const hookOwner = owner(n, 'hook');
  const { warmUp } = spec.hook;

  const lesson: Lesson = {
    lesson: n,
    title: spec.title,
    short: spec.short,
    minutes: spec.minutes,
    outcomes: [...spec.outcomes],
    summary: spec.summary,
    hook: {
      goal: spec.hook.goal,
      scenario: { ...spec.hook.scenario },
      warmUp: {
        question: warmUp.question,
        ...(warmUp.tree === undefined ? {} : { tree: tree(hookOwner, warmUp.tree) }),
        options: warmUp.options.map((option) => ({ ...option })),
        answer: warmUp.answer,
      },
      ...(spec.hook.bridge === undefined ? {} : { bridge: spec.hook.bridge }),
    },
    explore: spec.explore.map((entry, i) => explore(owner(n, `explore ${i + 1}`), entry)),
    explain: {
      pages: spec.explain.pages.map((page, i) => {
        const who = owner(n, `explain page ${i + 1}`);
        const { diagram: drawn, pseudocode: code, ...words } = page;
        return {
          ...words,
          ...(drawn === undefined ? {} : { diagram: diagram(who, drawn) }),
          ...(code === undefined ? {} : { pseudocode: pseudocode(code) }),
        };
      }),
    },
    worked: {
      examples: spec.worked.examples.map((example, i) => workedExample(owner(n, `worked example ${i + 1}`), example)),
    },
    tryIt: tryIt(n, spec.tryIt),
    activity: { title: spec.activity.title, items: spec.activity.items },
  };
  return deepFreeze(lesson);
}

//  the lesson files 

const FILES: Record<LessonNumber, unknown> = { 1: lesson1, 2: lesson2, 3: lesson3, 4: lesson4, 5: lesson5 };

function loadAll(): Readonly<Record<LessonNumber, LessonSpec>> {
  const specs = {} as Record<LessonNumber, LessonSpec>;
  const seen = new Map<string, LessonNumber>();
  for (const n of [1, 2, 3, 4, 5] as const) {
    const file = `lesson${n}.json`;
    const spec = validateLesson(FILES[n], file);
    if (spec.lesson !== n) throw new Error(`${file}: "lesson" is ${spec.lesson}, but the file is lesson ${n}`);
    for (const item of spec.activity.items) {
      const other = seen.get(item.id);
      if (other !== undefined) throw new Error(`${file}: item id "${item.id}" is also used in lesson${other}.json`);
      seen.set(item.id, n);
    }
    specs[n] = spec;
  }
  return Object.freeze(specs);
}

// The five lesson files, checked when the content module loads. 
export const LESSON_SPECS = loadAll();

const built = new Map<LessonNumber, Lesson>();

function checkNumber(n: LessonNumber): void {
  if (!Object.hasOwn(LESSON_SPECS, n)) throw new RangeError(`There is no lesson ${String(n)}; the lessons are 1 to 5`);
}

// A ready-to-show lesson, built on first use and the same object after that. 
export function getLesson(n: LessonNumber): Lesson {
  checkNumber(n);
  let lesson = built.get(n);
  if (lesson === undefined) {
    lesson = resolveLesson(LESSON_SPECS[n]);
    built.set(n, lesson);
  }
  return lesson;
}

// A lesson's activity questions for a retake (0 is the original keys), in order. 
export function activityQuestions(n: LessonNumber, retake = 0): Question[] {
  checkNumber(n);
  return LESSON_SPECS[n].activity.items.map((item) => resolveItem(item, n, retake));
}