/**
 The task kinds: for each, the answer parts, the values its text can use,
  the worked solution, and what to show on the tree before and after.
  Every answer comes from the engine. Internal to the content module.
 */
import {
  buildSteps,
  deleteSteps,
  depth,
  extremeSteps,
  findOffenders,
  height,
  insert,
  insertSteps,
  leaves,
  maxPath,
  minPath,
  remove,
  search,
  searchSteps,
  size,
  subtree,
  successor,
  traversalSteps,
  traverse,
} from '../engine';
import type { DeleteCase, Highlight, SearchResult, Slot, Step, Tree } from '../engine';
import type { AskSpec, Part } from './schema';
import {
  fail,
  listInWords,
  longestPath,
  outside,
  pathEdges,
  pathTo,
  plural,
  shiftKey,
  shiftNode,
  shuffledOrder,
  type Context,
  type Values,
} from './context';
import { buildPart, numberPick } from './parts';

// What a task works out.
export interface Worked {
  values: Values;
  // The task's own parts, or `null` if the item must write them (`fixed`).
  parts: Part[] | null;
  solution: Step[];
  base?: Highlight;
  result?: { tree: Tree; highlight: Highlight };
  deleteCase?: DeleteCase;
}

// A written solution step. The resolver freezes the whole question, steps included.
function step(tree: Tree, highlight: Highlight, text: string): Step {
  return { tree, highlight, text };
}

// Dim everything outside the subtree rooted at `key`, or nothing if that is the whole tree.
function dimOutside(tree: Tree, key: number | undefined): Highlight | undefined {
  if (key === undefined) return undefined;
  const dimmed = outside(tree, key);
  return dimmed.length === 0 ? undefined : { dimmed };
}

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

function needTree(context: Context): NonNullable<Tree> {
  if (context.tree === null) fail(context, `a "${context.item.ask.kind}" task needs a tree that is not empty`);
  return context.tree;
}

const CASE_INDEX: Record<DeleteCase, number> = { leaf: 0, one: 1, two: 2 };
const CASE_NAMES: Record<DeleteCase, string> = {
  leaf: 'Case 1, a leaf',
  one: 'Case 2, one child',
  two: 'Case 3, two children',
};
const ORDER_NAMES = { pre: 'pre-order', in: 'in-order', post: 'post-order' } as const;

//  Lesson 1 

function rootAndLeaves(context: Context, ask: Extract<AskSpec, { kind: 'rootAndLeaves' }>): Worked {
  const tree = needTree(context);
  const root = tree.key;
  const leafKeys = leaves(tree);
  const h = height(tree);
  const tags: Record<number, string> = { [root]: 'root' };
  for (const key of leafKeys) tags[key] = 'leaf';

  const parts: Part[] = [{ type: 'click', label: '', mode: 'set', answer: [root, ...leafKeys] }];
  const solution = [
    step(tree, { tags: { [root]: 'root' } }, `${root} has no parent: it is the root.`),
    step(
      tree,
      { tags },
      leafKeys.length === 1
        ? `${leafKeys[0]} has no children: it is a leaf.`
        : `${listInWords(leafKeys)} have no children: they are leaves.`,
    ),
  ];
  if (ask.withHeight) {
    parts.push(numberPick('Height of the tree', h));
    solution.push(
      step(
        tree,
        { edges: pathEdges(longestPath(tree)) },
        `The longest path from the root down to a leaf has ${plural(h, 'edge')}, so the height is ${h}.`,
      ),
    );
  }
  return { values: { root, leaves: leafKeys, height: h }, parts, solution };
}

function depthHeight(context: Context, ask: Extract<AskSpec, { kind: 'depthHeight' }>): Worked {
  const tree = needTree(context);
  if (ask.depthOf === undefined && ask.heightOf === undefined) {
    fail(context, 'a depthHeight task needs depthOf, heightOf or both');
  }
  const values: Values = {};
  const parts: Part[] = [];
  const solution: Step[] = [];

  if (ask.depthOf !== undefined) {
    const key = shiftNode(context, ask.depthOf, 'depthOf');
    context.depthOf = key;
    const d = depth(tree, key) as number;
    const path = pathTo(tree, key) ?? [];
    values.depth = d;
    parts.push(numberPick(`Depth of ${key}`, d));
    solution.push(
      step(
        tree,
        { visited: path, edges: pathEdges(path) },
        `From the root to ${key}: ${plural(d, 'edge')}, so the depth is ${d}.`,
      ),
    );
  }

  if (ask.heightOf !== undefined) {
    const key = shiftNode(context, ask.heightOf, 'heightOf');
    context.heightOf = key;
    const below = subtree(tree, key);
    const h = height(below);
    const isRoot = key === tree.key;
    values.height = h;
    parts.push(numberPick(isRoot ? 'Height of the tree' : `Height of the subtree rooted at ${key}`, h));
    solution.push(
      step(
        tree,
        { ...dimOutside(tree, key), edges: pathEdges(longestPath(below)) },
        `From ${isRoot ? 'the root' : key} down to a leaf: ${plural(h, 'edge')} at most, so the height is ${h}.`,
      ),
    );
  }

  return { values, parts, solution };
}

function validity(context: Context): Worked {
  const tree = needTree(context);
  const offenders = findOffenders(tree);
  const valid = offenders.length === 0;
  const values: Values = { valid: valid ? 'valid' : 'invalid', offenders };
  const parts: Part[] = [{ type: 'pick', label: '', options: ['Valid', 'Invalid'], answer: valid ? 0 : 1 }];

  if (valid) return { values, parts, solution: [] };

  if (offenders.length === 1) {
    values.offender = offenders[0] as number;
    parts.push({ type: 'click', label: 'The node that breaks the rule', mode: 'one', answer: offenders[0] as number });
  } else {
    parts.push({ type: 'click', label: 'The nodes that break the rule', mode: 'set', answer: offenders });
  }
  return { values, parts, solution: [], result: { tree, highlight: { offender: offenders[0] as number } } };
}

//  Lesson 2 

function searchPathTask(context: Context, ask: Extract<AskSpec, { kind: 'searchPath' }>): Worked {
  const key = shiftKey(context, ask.key, 'the task key');
  context.key = key;
  const result = search(context.tree, key);
  return {
    values: searchValues(key, result),
    parts: [
      { type: 'click', label: 'Path', mode: 'path', answer: [...result.path] },
      { type: 'pick', label: 'Result', options: ['Found', 'Not found'], answer: result.found ? 0 : 1 },
    ],
    solution: searchSteps(context.tree, key),
  };
}

function searchEnd(context: Context, ask: Extract<AskSpec, { kind: 'searchEnd' }>): Worked {
  const key = shiftKey(context, ask.key, 'the task key');
  context.key = key;
  const result = search(context.tree, key);
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
    solution: searchSteps(context.tree, key),
  };
}

function maxVisits(context: Context): Worked {
  const h = height(context.tree);
  const most = h + 1;
  const n = size(context.tree);
  // The height (counting edges, not nodes), one too many, and "a search checks every node".
  const options = [...new Set([h, most, h + 2, n])].sort((a, b) => a - b);
  return {
    values: { height: h, most, size: n },
    parts: [{ type: 'pick', label: '', options: options.map(String), answer: options.indexOf(most) }],
    solution: [],
  };
}

//  Lesson 3 

function insertSlot(context: Context, ask: Extract<AskSpec, { kind: 'insertSlot' }>): Worked {
  const tree = needTree(context);
  const key = shiftKey(context, ask.key, 'the task key');
  context.key = key;
  const result = search(tree, key);
  if (result.found) fail(context, `insertSlot needs a key that is not in the tree, but ${ask.key} is in it`);
  const slot: Slot = { parent: result.endAt, side: result.side };
  return {
    values: searchValues(key, result),
    parts: [{ type: 'place', label: '', keys: [key], answer: [slot] }],
    solution: insertSteps(tree, key),
    result: {
      tree: insert(tree, key).tree,
      highlight: { found: key, edges: pathEdges([...result.path, key]) },
    },
  };
}

function buildTask(context: Context, ask: Extract<AskSpec, { kind: 'build' }>): Worked {
  if (!Array.isArray(ask.keys) || ask.keys.length === 0) fail(context, 'a build task needs a list of keys');
  const keys = ask.keys.map((key) => shiftKey(context, key, 'build keys'));
  let tree = context.tree;
  const slots: Slot[] = [];
  const solution: Step[] = [];

  for (const [i, key] of keys.entries()) {
    const result = search(tree, key);
    if (result.found) fail(context, `build key ${ask.keys[i]} is already in the tree by then`);
    slots.push({ parent: result.endAt, side: result.side });
    if (context.tree !== null) solution.push(...insertSteps(tree, key));
    tree = insert(tree, key).tree;
  }

  return {
    values: { keys, root: (tree as NonNullable<Tree>).key },
    parts: [{ type: 'place', label: '', keys, answer: slots }],
    solution: context.tree === null ? buildSteps(keys) : solution,
    result: { tree, highlight: {} },
  };
}

function minMax(context: Context, ask: Extract<AskSpec, { kind: 'minMax' }>): Worked {
  const tree = needTree(context);
  const find = ask.find;
  if (
    !Array.isArray(find) ||
    find.length === 0 ||
    new Set(find).size !== find.length ||
    !find.every((which) => which === 'min' || which === 'max')
  ) {
    fail(context, 'a minMax task needs find: ["min"], ["max"] or both, each once');
  }
  const from = ask.from === undefined ? undefined : shiftNode(context, ask.from, 'from');
  context.from = from;
  context.find = find;

  const start = from === undefined ? tree : subtree(tree, from);
  const of = from === undefined ? '' : ` of the subtree rooted at ${from}`;
  const values: Values = from === undefined ? {} : { from };
  const parts: Part[] = find.map((which) => {
    const answer = (which === 'min' ? minPath(start) : maxPath(start)).at(-1) as number;
    values[which] = answer;
    return { type: 'click', label: `${which === 'min' ? 'Minimum' : 'Maximum'}${of}`, mode: 'one', answer };
  });

  return {
    values,
    parts,
    solution: find.flatMap((which) => extremeSteps(start, which)),
    ...(from === undefined ? {} : { base: dimOutside(tree, from) }),
  };
}

//  Lesson 4 

function traversal(context: Context, ask: Extract<AskSpec, { kind: 'traversal' }>): Worked {
  const tree = needTree(context);
  if (!(ask.order in ORDER_NAMES)) fail(context, `a traversal order is "pre", "in" or "post", not "${ask.order}"`);
  const from = ask.from === undefined ? undefined : shiftNode(context, ask.from, 'from');
  context.from = from;
  context.order = ask.order;

  const start = from === undefined ? tree : subtree(tree, from);
  const sequence = traverse(start, ask.order);

  // Deal the cards out of order: shuffled, and rotated by one if the shuffle left them in order.
  let cards = shuffledOrder(context, 0, sequence.length).map((i) => sequence[i] as number);
  if (sequence.length > 1 && cards.every((key, i) => key === sequence[i])) cards = [...cards.slice(1), cards[0] as number];

  return {
    values: { sequence, orderName: ORDER_NAMES[ask.order] },
    parts: [{ type: 'order', label: '', cards, answer: sequence }],
    solution: traversalSteps(start, ask.order),
    ...(from === undefined ? {} : { base: dimOutside(tree, from) }),
  };
}

//  Lesson 5 

function deleteTask(context: Context, ask: Extract<AskSpec, { kind: 'delete' }>): Worked {
  const tree = needTree(context);
  const key = shiftNode(context, ask.key, 'the task key');
  context.key = key;
  const removed = remove(tree, key);
  const deleteCase = removed.case as DeleteCase;
  const node = subtree(tree, key) as NonNullable<Tree>;

  const values: Values = { key, case: deleteCase, caseName: CASE_NAMES[deleteCase] };
  let found: number | undefined;
  if (deleteCase === 'one') found = values.child = (node.left ?? node.right)?.key as number;
  if (deleteCase === 'two') found = values.successor = removed.successor as number;

  const parts: Part[] = [
    { type: 'pick', label: 'Which case is this?', options: ['Leaf', 'One child', 'Two children'], answer: CASE_INDEX[deleteCase] },
  ];
  if (ask.successor) {
    if (deleteCase !== 'two') {
      fail(context, `a successor is only asked for when the node has two children, but ${ask.key} does not`);
    }
    parts.push({ type: 'click', label: 'Click the in-order successor', mode: 'one', answer: removed.successor as number });
  }
  if (typeof ask.result !== 'object' || ask.result === null || !Array.isArray(ask.result.options)) {
    fail(context, 'a delete task needs result: { options, answer } describing the tree afterwards');
  }
  parts.push(
    buildPart(
      context,
      values,
      {
        type: 'pick',
        label: 'What does the tree look like afterwards?',
        options: ask.result.options,
        answer: ask.result.answer,
        shuffle: true,
      },
      parts.length,
    ),
  );

  return {
    values,
    parts,
    solution: deleteSteps(tree, key),
    base: { tags: { [key]: 'delete' } },
    result: { tree: removed.tree, highlight: found === undefined ? {} : { found } },
    deleteCase,
  };
}

function successorTask(context: Context, ask: Extract<AskSpec, { kind: 'successor' }>): Worked {
  const tree = needTree(context);
  const key = shiftNode(context, ask.key, 'the task key');
  context.key = key;
  const right = (subtree(tree, key) as NonNullable<Tree>).right;
  if (right === null) {
    fail(context, `${ask.key} has no right subtree, so its successor is not the minimum of a right subtree`);
  }
  const next = successor(tree, key) as number;
  return {
    values: { key, successor: next, rightChild: right.key },
    parts: [{ type: 'click', label: 'The in-order successor', mode: 'one', answer: next }],
    solution: extremeSteps(right, 'min'),
  };
}

//  dispatch 

// Work out a task. Sets the task's key, subtree, order and so on in `context` for the presets.
export function work(context: Context): Worked {
  const ask = context.item.ask;
  switch (ask.kind) {
    case 'rootAndLeaves':
      return rootAndLeaves(context, ask);
    case 'depthHeight':
      return depthHeight(context, ask);
    case 'validity':
      return validity(context);
    case 'searchPath':
      return searchPathTask(context, ask);
    case 'searchEnd':
      return searchEnd(context, ask);
    case 'maxVisits':
      return maxVisits(context);
    case 'insertSlot':
      return insertSlot(context, ask);
    case 'build':
      return buildTask(context, ask);
    case 'minMax':
      return minMax(context, ask);
    case 'traversal':
      return traversal(context, ask);
    case 'delete':
      return deleteTask(context, ask);
    case 'successor':
      return successorTask(context, ask);
    case 'fixed':
      return { values: {}, parts: null, solution: [] };
    default:
      return fail(context, `there is no kind of task "${(ask as { kind: unknown }).kind}"`);
  }
}