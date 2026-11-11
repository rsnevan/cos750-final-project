/**
  The resolver: turns a lesson item from the JSON into a ready-to-show
  question for one retake. It builds the tree with that retake's keys, asks
  the engine for every answer, fills the text, works out the highlights and
  attaches the worked solution.
 
  Every key written in an item (in text as `{50}`, in a task, a tree
  reference, a written answer or a written highlight) is a retake-0 key and
  is shifted here. Values the resolver works out, such as `path`, are already
  in the retake's keys.
 
  The pieces live in: `context.ts` (shared helpers), `kinds.ts` (one function
  per task kind), `parts.ts` (written answer parts) and `highlights.ts`
  (presets and written highlights).
 */
import { preorder } from '../engine';
import type { Tree } from '../engine';
import { offsetFor } from './config';
import { deepFreeze } from './checks';
import { fail, fill, treeFromRef, type Context } from './context';
import { anyHighlight } from './highlights';
import { work } from './kinds';
import { buildPart } from './parts';
import type { ItemSpec, LessonId, Part, Question } from './schema';

// The item's tree for this retake, or an empty tree for a build with none.
function buildTree(item: ItemSpec, retake: number, offset: number): Tree {
  if (item.tree === undefined) {
    if (item.ask.kind !== 'build') fail({ item }, `a "${item.ask.kind}" task needs a tree`);
    return null;
  }
  return treeFromRef({ item }, item.tree, retake, offset);
}

// Resolve one item for a retake (0 is the original keys). Throws an Error naming the item if anything in it is wrong.
export function resolveItem(item: ItemSpec, lesson: LessonId, retake = 0): Question {
  const offset = offsetFor(retake); // throws a RangeError for a bad retake number
  const tree = buildTree(item, retake, offset);
  const context: Context = { item, retake, offset, tree, keys: new Set(preorder(tree)) };

  const worked = work(context);
  const { values } = worked;

  let parts: Part[];
  if (item.parts === undefined) {
    if (worked.parts === null) fail(context, `a "${item.ask.kind}" task needs its parts written in the item`);
    parts = worked.parts;
  } else {
    parts = item.parts.map((spec, index) => buildPart(context, values, spec, index));
  }
  if (parts.length < 1 || parts.length > 3) fail(context, `a question has one to three parts, not ${parts.length}`);

  const hints = item.hints.map((hint, index) => {
    const where = `hint ${index + 1}`;
    const text = fill(context, values, hint.text, where);
    return hint.highlight === undefined
      ? { text }
      : { text, highlight: anyHighlight(context, values, hint.highlight, where) };
  });
  const base = item.base === undefined ? worked.base : anyHighlight(context, values, item.base, 'base');
  const optional = (name: 'intro' | 'misconception' | 'bridge') =>
    item[name] === undefined ? {} : { [name]: fill(context, values, item[name] as string, name) };

  const question: Question = {
    id: item.id,
    lesson,
    outcome: item.outcome,
    retake,
    ...optional('intro'),
    prompt: fill(context, values, item.prompt, 'prompt'),
    tree,
    ...(base === undefined ? {} : { base }),
    parts,
    hints,
    explanation: fill(context, values, item.explanation, 'explanation'),
    solution: worked.solution,
    ...(worked.result === undefined ? {} : { result: worked.result }),
    ...(worked.deleteCase === undefined ? {} : { deleteCase: worked.deleteCase }),
    ...optional('misconception'),
    ...optional('bridge'),
  };
  return deepFreeze(question);
}