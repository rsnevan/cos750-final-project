# Visualiser Guide
## At a glance

The visualiser draws trees and plays animations; it never works anything out about a tree. Every tree, every animation frame and every highlight comes ready-made from the engine (`src/engine`) or the lesson content (`src/content`). Everything you need is on this page.

| The engine and lesson content decide | The visualiser decides |
| --- | --- |
| What happens: the path, the comparisons, the delete case, the new tree | How it looks: positions, colours, shapes and labels |
| What to emphasise in each frame (the `Highlight` fields) | How each highlight is drawn, always with a shape or label as well as colour |
| The sentence for each frame | Showing it, announcing it to screen readers, reading it aloud when narration is on |
| The pseudocode line for each frame | The pseudocode panel, with that line highlighted |
| The tree-as-text sentences | The "Show the tree as text" panel |
| | The player: Back, Step, Replay, speed, keyboard, reduced motion |
| | Reporting clicks on nodes and empty spots to the lesson screens |

The `Highlight` fields are a shared contract. If you need a new kind of emphasis, ask for it to be added to the engine with tests, rather than working it out in the visualiser.

## Trees and layout

A tree is its root node, or `null` for the empty tree. Every node is `{ key, left, right }`, where `left` and `right` are nodes or `null`, and keys are whole numbers.

The engine is TypeScript, but the visualiser can be written in JavaScript. Import from the folder; Vite finds its `index.ts`, and hovering over a function in VS Code shows what it does.

```js
import { build, fromShape, inorder, depth, emptySlots, allowedRange } from '../engine';
import { getTree } from '../content';
```

| To get | Use | Example |
| --- | --- | --- |
| A lesson tree by name | `getTree(name)` | `getTree('T')`; the names are T, T2, U, X, V, W, SWAP and T55 |
| A tree from keys inserted in order | `build(keys)` | `build([50, 30, 70, 20, 40, 60, 80])` gives tree T |
| A tree drawn exactly, even an invalid one | `fromShape(shape)` | `fromShape([50, [30], [70, [40]]])` gives tree X |

A shape is `[key, left, right]`. A missing child is `null`, or left off at the end: `[25, [22]]` is 25 with only a left child 22, and `[40, null, [45]]` is 40 with only a right child 45.

### A simple layout

This never overlaps: a node's column is its position in in-order, and its row is its depth.

```js
const order = inorder(tree);                 // keys left to right: [20, 30, 40, 50, 60, 70, 80]
const column = (key) => order.indexOf(key);  // 0, 1, 2, ...
const row = (key) => depth(tree, key);       // the root is 0
```

This works for invalid trees too: in-order is just left to right.

### Empty spots

Empty spots are where a key could be placed. `emptySlots(tree)` gives them left to right, each as `{ parent, side }`, such as `{ parent: 60, side: 'right' }`. The empty tree has one: `{ parent: null, side: null }`.

They fit between the columns: empty spot number `i` sits at column `i - 0.5`, one row below its parent. In T, the 8 empty spots sit between and beside the 7 keys.

`allowedRange(tree, slot)` gives the keys that fit an empty spot, such as `{ lo: 61, hi: 69 }` for the right of 60 in T. `null` means no limit on that side. The lesson content already turns this into a label where one is needed (see `slotLabel`).

## Steps and the player

An animation is a list of steps, and each step is a complete snapshot of one frame. The player only moves an index through the list: Back is `i - 1`, Step is `i + 1`, Replay is `i = 0`. Nothing needs undoing, because every step carries its own tree.

```js
// Each step:
{
  tree,        // the tree to draw in this frame
  highlight,   // what to emphasise (see Highlight fields)
  text,        // one sentence: show it, announce it, read it aloud
  line,        // which pseudocode line to highlight (may be missing)
}
```

A minimal player:

```js
import { build, searchSteps, PSEUDOCODE } from '../engine';

const tree = build([50, 30, 70, 20, 40, 60, 80]);
const steps = searchSteps(tree, 60);   // 3 frames: right at 50, left at 70, found 60
let i = 0;

function show() {
  const step = steps[i];
  drawTree(step.tree, step.highlight);           // the visualiser's own drawing
  caption.textContent = step.text;               // shown on screen
  liveRegion.textContent = step.text;            // announced (aria-live="polite")
  highlightLine(PSEUDOCODE.search, step.line);   // the pseudocode panel
}

nextButton.onclick = () => { i = Math.min(i + 1, steps.length - 1); show(); };
backButton.onclick = () => { i = Math.max(i - 1, 0); show(); };
replayButton.onclick = () => { i = 0; show(); };
show();
```

| Builder | Lesson | Pseudocode |
| --- | --- | --- |
| `searchSteps(tree, key)` | 2 | `PSEUDOCODE.search` |
| `insertSteps(tree, key)` | 3 | `PSEUDOCODE.insert` |
| `buildSteps(keys)` | 3 | none |
| `extremeSteps(tree, 'min' or 'max')` | 3 | none |
| `walkSteps(tree)` | 4, explore: the marker walk passing every node three times | none |
| `traversalSteps(tree, 'pre', 'in' or 'post')` | 4 | `PSEUDOCODE.traverse` |
| `deleteSteps(tree, key)` | 5 | `PSEUDOCODE.delete` |

Most animations reach the visualiser already built, inside a lesson or a question (see Where the pictures come from). The builders are there for testing the player on its own.

Steps are frozen, so they can't be changed by accident; copy anything you need to change for drawing. Consecutive steps often share the same tree object, so re-layout can be skipped when `step.tree === previous.tree`.

## Highlight fields

A highlight only has the fields that apply; a missing field means nothing to show. Every key it mentions is a node in the tree it's drawn on. Colour is never the only signal, as the ID document requires, so each field has a suggested shape or label too. The look is the visualiser's call.

| Field | Value | Meaning | Suggested cue besides colour | Used by |
| --- | --- | --- | --- | --- |
| `visited` | keys, in order | Nodes visited so far | A number badge (1, 2, 3) on each | Search, insert, min/max, traversals, hints |
| `current` | key | The node being looked at now | A thick ring | Search, insert, min/max, delete |
| `found` | key | Found, newly placed or chosen | A double ring or a tick | Search, insert, build, min/max, delete, results |
| `offender` | key | Breaks the BST rule | A cross mark | Lesson 1, final test |
| `outlined` | keys | Nodes to notice, such as a node's children | A dashed outline | Delete, hints |
| `dimmed` | keys | Ruled out, such as the half a search skips | Faded, at lower opacity | Hints, subtree questions |
| `edges` | `[parent, child]` pairs | Links along a path | A thicker line | Search, insert, delete, hints |
| `edgeLabels` | `[parent, child, label]` triples | A short label on an edge, such as `[50, 30, 'all smaller']` | The label itself, beside the middle of the edge | Lessons 1 and 2, explain |
| `tags` | `{ key: label }` | Short words beside nodes, such as `{ 50: 'root' }` | The label itself | Lesson 1 labelling, delete |
| `slot` | `{ parent, side }` | An empty spot: where a search stopped or a key goes | A dashed empty circle where the child would be | Search (not found), insert, hints |
| `slotLabel` | text | A short label beside `slot`, such as the keys allowed there: "61 to 69" | A speech bubble next to the empty circle | Lesson 1, try it |
| `dots` | `'pre'`, `'in'`, `'post'` or `'all'` | The traversal dots on every node, for one order or all three | Small dots on the left, bottom or right of each node | Traversals |
| `marker` | `{ key, position }` | A marker passing one side of one node | An arrow or bead at that side | Traversals |
| `output` | keys | The traversal sequence written so far | A list under the tree | Traversals |
| `relabel` | `{ from: to }` | Show node `from` with key `to`, without changing the tree | The new key, with the old one small or struck through | Delete, two children |
| `ghost` | key | A node about to be removed: the old successor | Drawn dashed | Delete, two children |

**Why `relabel` and `ghost`:** when a node with two children is deleted, the successor's key is copied into it first. The wireframe briefly drew the same key twice, but a tree never holds a key twice. Instead, the frame says: show node 50 as 60 (`relabel: { 50: 60 }`), and draw the old 60 dashed (`ghost: 60`). The picture is the same.

## Where the pictures come from

Every picture in the app is either one tree with a highlight, or a list of steps. Both come from the lesson content, already built, so one drawing function and one player cover the whole app.

| Where | What to draw | Kind |
| --- | --- | --- |
| Hook | `lesson.hook.warmUp.tree`, when there is one | A tree, no highlight |
| Explore | The `tree` of each explore activity; `walk` also has `steps`; `deleteTry` options each have a `result` tree (or `null` when the move is impossible) | Trees and steps |
| Explain | `lesson.explain.pages[i].diagram`, plus `pseudocode.lines` for the panel | A tree with a highlight |
| Worked examples | `lesson.worked.examples[i].steps`, plus `pseudocode.lines` when there is pseudocode | Steps |
| Try it | `lesson.tryIt.tree`; `search`, `insert` and `traversal` also have `solution` steps; each `guided` step has a `highlight`, and some have an `after` tree with its highlight | Trees and steps |
| A question | `question.tree` drawn with `question.base` (may be missing) | A tree with a highlight |
| Hint, rung 2 | `question.hints[1].highlight` on the question's tree | A highlight |
| Hint, rung 3 | `question.solution` | Steps |
| After answering | `question.result.tree` with `question.result.highlight`, when there is a result | A tree with a highlight |

The lesson content is loaded with `getLesson(n)` and the questions with `activityQuestions(n, retake)` or `finalQuestions(retake)`, all from `src/content`.

**Two things to handle:**

- **A hint on top of a base highlight.** Draw `{ ...question.base, ...hint.highlight }`: a hint field replaces the base field of the same name. For example, a subtree question dims the rest of the tree from the start, and a hint adds edges to that.
- **The empty tree.** One question builds a tree from nothing, so `question.tree` is `null`. Draw it as one empty spot.

## Clicks the lesson screens need

Many questions are answered on the tree itself, so the tree drawing reports two kinds of click to the lesson screens. The lesson screens then check the answer with `checkPart`; the visualiser never judges an answer.

| The student | The visualiser reports | Used for |
| --- | --- | --- |
| Clicks a node | Its key, such as `60` | Click questions (one node, a set, or a path), explore and try-it |
| Clicks an empty spot | `{ parent, side }`, such as `{ parent: 60, side: 'right' }` (`{ parent: null, side: null }` for an empty tree) | Placing a key: insert and build questions, Lesson 3 explore and try-it |

The student's own picks so far, such as the nodes clicked in a path, aren't in any highlight. The lesson screens hold them and pass them in. A suggested shape for the drawing function, to agree between the visualiser and the lesson screens:

```js
drawTree(container, tree, highlight, {
  onNode: (key) => { /* a node was clicked */ },
  onSlot: (slot) => { /* an empty spot was clicked: { parent, side } */ },
  showSlots: true,       // draw the empty spots as clickable (placing questions)
  selected: [50, 30],    // the student's picks so far
  numbered: true,        // number the picks 1, 2, 3 (click-path questions)
});
```

For keyboard and screen reader users, make every node and clickable empty spot focusable with Tab, clickable with Enter or Space, and labelled, such as "Node 50" or "Empty spot right of 60".

Order cards (Lesson 4) and multiple-choice options are part of the lesson screens, not the tree drawing.

## Text, screen readers, narration and pseudocode

**Step text.** Each `step.text` makes sense with no picture, such as "Now at 70. 60 is smaller than 70, so go left." The wording comes from the lesson team's wireframe.

- **Show it** as the caption under the tree.
- **Announce it** by putting it in an `aria-live="polite"` region, so screen readers read each frame as it appears.
- **Read it aloud** only when the narration setting is on (off by default), with the browser's `speechSynthesis`.

**Tree as text.** `describe(tree)` from the engine gives one sentence per node, root first, for the "Show the tree as text" panel:

```text
50 is the root. It has left child 30 and right child 70.
30 has left child 20 and right child 40.
20 is a leaf.
```

The sentences describe the tree completely: the tests rebuild every lesson tree from them alone. They work for invalid trees too, so Lesson 1's "Spot the BST" can be done with a screen reader.

**Pseudocode.** `PSEUDOCODE.search`, `.insert`, `.traverse` and `.delete` are lists of lines, word for word from the wireframe; lesson pages and worked examples carry the same `lines`. Highlight line `step.line`; when a step has no line, highlight nothing. `LINES` gives line numbers by name, such as `LINES.search.goLeft`, if one is ever needed directly.

**Reduced motion.** Steps are snapshots, so with reduced motion on, swap from one frame to the next instead of animating between them. Nothing else changes.

## Rules and what's ready

Everything the visualiser needs is ready and tested: every animation builder, every highlight field above, and every lesson's diagrams, animations and questions.

- **Never change a tree, a step or a highlight.** They are frozen, and changing one throws an error. To show something new, ask for a new highlight field.
- **Don't write BST logic in the visualiser.** If a drawing needs a fact about a tree, the engine has it: `parentOf`, `height`, `depth`, `leaves`, `isLeaf`, `childCount`, `size`, `min`, `max`.
- **Keys are numbers, never strings.** Convert input first with `Number(value)`. Passing `"60"` throws an error rather than quietly finding nothing.
- **Expect the empty tree.** `null` is a valid tree; draw it as one empty spot.
- **Ignore unknown highlight fields** rather than failing, so a new field never breaks the player.

Each change to the engine or the lesson content comes with tests, and this page is updated to match.