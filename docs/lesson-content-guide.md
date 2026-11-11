# Lesson Content Guide
## At a glance

All five lessons and the final test are written, checked and ready to show. The lesson and assessment screens only display them and record what the student does: every answer, hint highlight and animation is already worked out.

The content lives in JSON files in `src/content/data/`. Code in `src/content/` checks those files when the app loads, then turns them into ready-to-show lessons and questions, asking the tree engine (`src/engine/`) for every answer. The screens import everything from `src/content`, never from individual files.

Three ideas explain almost everything else:

1. **Questions store a task, not an answer.** A question says "search tree T for 65". The engine works out the path, so an answer can't be mistyped.
2. **Retakes shift every key.** A retake adds the same number to every key (for example +7), so the tree keeps its shape and every answer moves with it. The JSON writes keys in questions as `{65}` so they shift too.
3. **Every file is checked.** A mistake in a JSON file fails `npm test` and names the file and the exact place, such as `lesson3.json: activity.items[2].ask.key must be a whole number`.

## What is done

Everything below is built and covered by 729 passing tests. Every answer was compared with the lesson plan's tables, and all 195 questions (39 items on 5 retakes each) were re-checked by a separate program written from the lesson plan's definitions.

| Part | What it gives the screens | File |
| --- | --- | --- |
| Settings | Pass mark, retry band, hint rungs, retake offsets and other rules, in one place | `data/config.json` |
| Lesson trees | T, T2, U, X, V, W, SWAP and the 55 tree, by name | `data/trees.json` |
| Lessons 1 to 5 | All six stages of each lesson: hook, explore, explain, worked examples, try it and the activity | `data/lesson1.json` to `data/lesson5.json` |
| Activities | 29 questions (6, 5, 6, 6 and 6), each with two hints and a worked solution | inside each lesson file |
| Final test | 10 questions on tree U with no hints, plus the results rules | `data/final.json` |
| Retakes | The same questions with every key shifted, for unlimited retakes | `data/config.json` |
| Answer checking | Right or wrong for each answer, with step-by-step feedback for paths, orders and builds | `check.ts` |
| Results | Score, each outcome secure or not, the descriptor and a question for the lecture | `finalTest.ts` |
| Answer sheet | Every question's answers on every retake, for checking and for the ID document | `docs/answer-sheet.md` |

What the screens still own: drawing the pages, taking clicks and drags, the hint ladder's buttons, applying the pass rules, saving progress, and the results page. The content gives each of these the data it needs.

## Using it in the screens

The screens need about seven calls. Everything they return is frozen, so it can't be changed by accident.

```js
import { getLesson, activityQuestions, checkQuestion, countsAsCorrect,
         finalQuestions, finalResults, CONFIG } from '../content';

const lesson = getLesson(2);                // all six stages of Lesson 2, ready to show
const questions = activityQuestions(2, 0);  // its activity, retake 0 (the original keys)

const q = questions[0];                     // "Click the nodes visited when searching for 20..."
const result = checkQuestion(q, [[50, 30, 20], 0]);  // one response per part
result.correct;                             // true
countsAsCorrect(result.correct, rungsShown); // false once the worked solution was shown
```

| Call | Gives |
| --- | --- |
| `getLesson(n)` | Lesson `n` (1 to 5) with every stage ready: trees built, animations made, answers worked out |
| `activityQuestions(n, retake)` | The lesson's activity questions for a retake (0 is the original keys) |
| `checkPart(part, response)` | Whether one part is right, with feedback (below) |
| `checkQuestion(q, responses)` | Every part checked; right only when every part is |
| `countsAsCorrect(correct, rungsShown)` | Whether a right answer counts towards the pass mark |
| `finalQuestions(retake)` | The final test's 10 questions |
| `finalResults({ itemId: true or false })` | The results screen: score, each outcome secure or not, descriptor, lecture question |
| `CONFIG` | The settings from `config.json` |

### A question

| Field | What it is |
| --- | --- |
| `id`, `retake` | Save these two to remember where a student is |
| `lesson`, `outcome` | Lesson 1 to 5 or `'final'`; LO1 to LO6 |
| `intro` | Optional short line above the prompt, such as "Predict first, then check." |
| `prompt` | The question |
| `tree`, `base` | The tree to draw, and what to highlight on it from the start (such as a dimmed part of the tree) |
| `parts` | One to three answers to give (below) |
| `hints` | Rung 1 (`hints[0].text`) and rung 2 (`hints[1].text` plus a highlight to draw). Empty in the final test |
| `solution` | Rung 3: animation steps to play. When empty, show `explanation` instead |
| `explanation` | Shown after answering |
| `result` | Optional tree to show after answering, such as the tree after an insert or delete |
| `deleteCase` | Lesson 5: `leaf`, `one` or `two`, for the one-of-each-case pass rule |
| `misconception`, `bridge` | Optional lines for targeted feedback, and a link to a later lesson |

### Parts and the responses they take

| Part | The student | Response to pass to `checkPart` |
| --- | --- | --- |
| `pick` | Picks one option | The option's index, counting from 0 |
| `click`, mode `one` | Clicks one node | The key |
| `click`, mode `set` | Clicks several nodes, any order | The keys |
| `click`, mode `path` | Clicks nodes in order | The keys, in order |
| `order` | Puts the `cards` in order | The keys, in order |
| `place` | Places each of `keys` in an empty spot | One `{ parent, side }` per key, in order |

`checkPart` returns `correct`, plus:

- for a path, order or place: `onTrack` (every step so far is right) and `firstWrong` (where it went wrong). This is how the explore and try-it stages say "that works" or "look again" after each click: check the clicks so far, and look at `onTrack`.
- for a set of clicks: `missing` and `extra` keys.

A response of the wrong kind, such as a list for a pick part, throws an error, because that's a screen bug rather than a student mistake.

### The hint ladder

Rung 1 shows `hints[0].text`. Rung 2 shows `hints[1].text` and draws `hints[1].highlight`. Rung 3 plays `solution`, or shows `explanation` if `solution` is empty. Pass the number of rungs shown to `countsAsCorrect`.

### Retakes and the pass rules

A retry with new keys is the same item with the next retake number: `activityQuestions(n, retake + 1)`. Retake numbers past the last offset wrap round. The pass mark, retry band and Lesson 5 rule are in `CONFIG`. Applying them is the screens' job.

### Explore and try-it stages

These are interactive screens built by the screens team. The lesson file holds their wording and settings, and `getLesson` adds the answers from the engine.

| Stage | Kind | What `getLesson` adds |
| --- | --- | --- |
| Explore | `relatives` (L1) | The tree |
| Explore | `pickTree` (L1) | The trees to choose from |
| Explore | `freeSearch` (L2) | `path`: the nodes to click |
| Explore | `slotProbe` (L3) | `slot`: where the key belongs |
| Explore | `walk`, `orderGuess` (L4) | The marker walk's `steps`, and the order to guess as `answer` |
| Explore | `deleteTry` (L5) | Each option's resulting tree, whether it keeps the BST rule (`valid`) and whether it's `possible` |
| Explore | `reflect` | The options and a reply for each; `answer: null` means any choice is fine |
| Try it | `search` (L2), `insert` (L3) | The `path` to click, the `slot` for an insert, and the animation |
| Try it | `traversal` (L4) | The `sequence` to click, and the animation |
| Try it | `guided` (L1, L5) | Steps that ask for a node (`accept`: the keys that count) or a choice, each with right and wrong replies |

## Decisions made

These were decided while building, mostly following the lesson plan and the ID document. Any of them can be changed: the last column says where. After any change, run `npm test` (see How to change things).

| # | Decision | Why | Where to change it |
| --- | --- | --- | --- |
| 1 | An activity passes at 80%; 60% to 79% shows explanations, then a retry of the missed items | Lesson plan | `config.json`: `passThreshold`, `middleBand` |
| 2 | Three hint rungs: a nudge, a highlight, then the worked solution | Lesson plan | `config.json`: `hintRungs` (1 to 3); each question's `hints` |
| 3 | A right answer counts only if the worked solution wasn't shown first | Otherwise reading the solution would earn the mark | `config.json`: `countCorrectAfterSolution` |
| 4 | Lesson 5 also needs one right answer for each delete case | Lesson plan, so the hard case can't be skipped | `config.json`: `lesson5NeedsEveryDeleteCase` |
| 5 | Retakes add the same number to every key: +0, +7, −7, +13, +3, then repeat | Keeps the shape and every answer. The lesson plan's "times 3 plus 7" makes three-digit keys that don't fit the nodes | `config.json`: `retakeOffsets`, `keyRange` (1 to 99) |
| 6 | Questions store the task, and the engine works out the answer | Answers can't be mistyped, and retakes stay right | Not a setting: how the content works |
| 7 | Keys in activity text are written `{50}`; stage text uses plain numbers | Only the activity changes keys; stages always show the original tree | The lesson files |
| 8 | Height counts edges, so a single node has height 0 | Lesson plan's definition | The engine, with its tests |
| 9 | Deleting a node with two children uses the in-order successor | Lesson plan | The engine, with its tests |
| 10 | Written options are shuffled only when a part says `"shuffle": true`, the same way each time for the same question and retake. Delete results are always shuffled, and traversal cards are always dealt out of order | The right option is often written first | Each pick part's `shuffle` |
| 11 | If a question has no animation, rung 3 shows the explanation | Some questions, such as "the most nodes a search can visit", have nothing to animate | The screens |
| 12 | "Click the node that breaks the rule" is only asked when the tree is invalid, and must be answered | The lesson plan's answers name the node | The question's `parts` |
| 13 | A response of the wrong kind is an error; a node clicked twice in a set counts once | A wrong kind is a screen bug, not a student mistake | `check.ts` |
| 14 | Every question id is unique across all lessons and the final test; progress is saved as id plus retake number | Saved progress stays valid when files change | The lesson files |
| 15 | Explore and try-it are screens of their own; the files hold their wording and settings | Each one works differently | The lesson files and the screens |
| 16 | The final test has no hints; an outcome is secure only when every question for it is right | Lesson plan and ID document | `final.json` |
| 17 | Excellent needs 9 or 10 and the two-children delete right | The ID document says so; the lesson plan only says 9 to 10 | `final.json`: remove `"requires"` from Excellent for the lesson plan's version |
| 18 | The lecture question is for the first outcome that isn't secure, or LO6's if all are | Wireframe | `finalTest.ts` |
| 19 | Wording is the wireframe's, word for word, except the three corrections below | The lesson team wrote it | The lesson files |

### Corrections to the wireframe

These three were wrong in the wireframe, so they were fixed. Tests check each one against the engine.

1. **Lesson 1, try it.** It pointed at the empty spot left of 70, but 60 is there. It now uses the spot right of 60, which allows 61 to 69, so 65 is still the answer.
2. **Lesson 1, question 5, rung 2.** It called 55's position "the empty spot right of 30", but 55 sits there. It now says that spot only allows keys from 31 to 49.
3. **Lesson 5, explain diagram.** The caption said 60 is the successor of both 50 and 70. The successor of 70 is 80, as in the worked example, so the diagram and caption now show 80.

## How to change things

Most changes are an edit to one JSON file in `src/content/data/`, followed by two commands. No code changes are needed unless a change needs a new kind of question.

### Every time: check your change

1. Run `npm test`. If something is wrong, the first failing test names the file and the place, for example `lesson3.json: activity.items[2].prompt must be text` or `Item "l2-search-20": hint 2: there is no highlight preset "otherhalf"`.
2. Run `npm run answers` to update `docs/answer-sheet.md`. A test fails until you do, so the sheet always matches the lessons.
3. Read the changed rows of the answer sheet, then commit the JSON file and the sheet together.

### Change a setting

Edit `config.json`. For example, to pass at 75%:

```json
"passThreshold": 0.75,
```

Shares are written from 0 to 1. `middleBand` must stay below `passThreshold`. `retakeOffsets` must start with 0 and not repeat, and every tree must stay inside `keyRange` on every retake; the tests name the tree that doesn't.

### Change wording

Find the text in the lesson file and edit it.

- **Stage text** (hook, explore, explain, worked examples, try it): write numbers plainly, such as `Search for 60.` Braces are rejected here.
- **Activity and final test text**: write every key as `{60}`, so it changes on a retake. Plain numbers stay as they are, which is right for counts such as `3 comparisons`.
- **Worked-out values**: write `{path}`, `{successor}` and so on to show a value the engine works out. The Reference section lists the values each kind of question gives.

### Change a question's key or tree

Edit its `ask` or `tree`, then the `{…}` keys in its text to match. The answers, hints and animations update themselves.

```json
"tree": "T",
"ask": { "kind": "searchPath", "key": 25 },
"prompt": "Click the nodes visited when searching for {25}, in order. Then give the result.",
```

Keys are always written as they are in the original tree (retake 0).

### Add a question

Copy a question of the same kind, then change four things:

1. A new `id`: lowercase letters, digits and dashes, unique across every file, such as `l2-search-35`.
2. The `ask`: choose a kind from the Reference section.
3. The `prompt`, two `hints` and the `explanation`.
4. The `outcome`, which must be one of the lesson's outcomes.

```json
{
  "id": "l2-search-35",
  "outcome": "LO3",
  "tree": "T",
  "ask": { "kind": "searchPath", "key": 35 },
  "prompt": "Click the nodes visited when searching for {35}, in order. Then give the result.",
  "hints": [
    { "text": "At each node, ask: is {35} smaller or larger than this node?" },
    { "text": "The half that cannot hold {35} is dimmed.", "highlight": "otherHalf" }
  ],
  "explanation": "The search visits {path}, then reaches the empty {side} side of {endAt}: not found."
}
```

Remember the lesson plan's question counts (6, 5, 6, 6, 6 and 10) are checked by a test; update that test if the number is meant to change.

### Write your own answer options

Add `parts` to replace a question's usual answers. A pick part names the right option by its position, counting from 0; add `"shuffle": true` if the right one is written first.

```json
"parts": [{ "type": "pick", "options": ["Yes", "No"], "answer": 0 }]
```

A click part's answer is either keys (written as in retake 0) or the name of a worked-out value, such as `"path"`. A question of kind `fixed` has nothing to work out, so it must write its parts.

### Change a hint's highlight

Use a preset name from the Reference section, or write the highlight out with original keys. Written keys are shifted on retakes and checked: a key not in the tree, or an "empty spot" that isn't empty, fails the tests.

```json
{ "text": "The left subtree of the root is outlined.", "highlight": { "outlined": [30, 20, 40] } }
```

### Add or change a tree

Edit `trees.json`. Build a valid tree by listing keys in insert order, or draw any tree exactly (needed for invalid trees):

```json
"T": { "insert": [50, 30, 70, 20, 40, 60, 80] },
"X": { "shape": [50, [30], [70, [40]]] }
```

A shape is `[key, left, right]`, with `null` for a missing child. Every key must stay from 1 to 99 on every retake.

### Change the final test results

Edit `descriptors` in `final.json`. They go from highest `min` score to lowest, and the last must have `min` 0. `requires` lists question ids that must also be right for that descriptor.

## Reference

### Kinds of question

A question's `ask` picks one of these. The kind decides the answers it asks for and the values its text can use as `{name}`. Values marked * only exist when the key is not in the tree.

| Kind | Fields in `ask` | Asks the student to | Values for the text | Used in |
| --- | --- | --- | --- | --- |
| `rootAndLeaves` | `withHeight` (optional) | Click the root and every leaf; pick the height too with `withHeight` | `root`, `leaves`, `height` | L1, final |
| `depthHeight` | `depthOf`, `heightOf` (one or both) | Pick a node's depth, and/or a subtree's height | `depth`, `height` | L1 |
| `validity` | none | Pick valid or invalid; if invalid, click the node that breaks the rule | `valid`, `offender`, `offenders` | L1, final |
| `searchPath` | `key` | Click the search path in order, then pick found or not found | `key`, `path`, `visits`, `result`, `endAt`*, `side`* | L2, final |
| `searchEnd` | `key` (not in the tree) | Click the node where the search stops, then pick the empty side | `key`, `path`, `endAt`, `side` | L2 |
| `maxVisits` | none | Pick the most nodes a search can visit | `height`, `most`, `size` | L2 |
| `insertSlot` | `key` (not in the tree) | Place the key in its empty spot | `key`, `path`, `endAt`, `side` | L3, final |
| `build` | `keys` | Place the keys one at a time, into an empty tree or the question's tree | `keys`, `root` | L3 |
| `minMax` | `find`: `["min"]`, `["max"]` or both; `from` (optional) | Click the minimum and/or maximum, of the whole tree or a subtree | `min`, `max`, `from` | L3, final |
| `traversal` | `order`: `"pre"`, `"in"` or `"post"`; `from` (optional) | Put the cards in traversal order | `sequence`, `orderName` | L4, final |
| `delete` | `key`, `result` (written options and answer), `successor` (optional) | Pick the case, click the successor (if asked), pick the tree afterwards | `key`, `caseName`, `child` (one child), `successor` (two children) | L5, final |
| `successor` | `key` | Click the in-order successor | `key`, `successor`, `rightChild` | L5 |
| `fixed` | none | Whatever its own `parts` ask | none | any |

Some kinds also set what is shown on the tree before and after answering: `insertSlot`, `build` and `delete` show the new tree afterwards; `validity` marks the node that breaks the rule; `delete` tags the node to delete; `minMax` and `traversal` with `from` dim the rest of the tree.

A question's `tree` is a name from `trees.json`, or a named tree changed first, such as `{ "from": "T", "delete": [50] }` for "T after deleting the root".

### Highlight presets for hints

| Preset | Shows | Needs a question with |
| --- | --- | --- |
| `path` | The nodes and edges a search for the key visits | A key |
| `otherHalf` | The half of the tree that can't hold the key, dimmed | A key that isn't the root |
| `emptySpot` | The empty spot where a search for the key stops | A key not in the tree |
| `longestPath` | The edges of a longest path from the root down to a leaf | Any tree |
| `leaves` | Every leaf, outlined | Any tree |
| `depthHeight` | The edges down to `depthOf`, and the subtree rooted at `heightOf` outlined | The `depthHeight` kind |
| `extremePaths` | The edges going left (minimum) and right (maximum) | The `minMax` kind |
| `outsideSubtree` | Everything outside a subtree, dimmed | A `from` or a key |
| `dots` | The traversal dots for the question's order | The `traversal` kind |
| `children` | The key's children, outlined | A key |
| `rightSubtree` | The key's right subtree outlined, the rest of the tree dimmed | A key with a right subtree |

A written highlight can use any field from the visualiser guide, such as `outlined`, `dimmed`, `edges`, `tags` or `slot`.

## Where everything lives

Paths are from the project root. Content changes only ever need the files in `src/content/data/`.

| File | What it is |
| --- | --- |
| `src/content/data/config.json` | The settings |
| `src/content/data/trees.json` | The named trees |
| `src/content/data/lesson1.json` to `lesson5.json` | The five lessons |
| `src/content/data/final.json` | The final test and its results rules |
| `src/content/index.ts` | Everything the screens import |
| `src/content/lessons.ts`, `finalTest.ts` | Load the files; `getLesson`, `activityQuestions`, `finalQuestions`, `finalResults` |
| `src/content/resolve.ts`, `kinds.ts`, `parts.ts`, `highlights.ts`, `context.ts` | Turn a question in the JSON into a ready question for a retake |
| `src/content/check.ts` | Checking students' answers |
| `src/content/validateLesson.ts`, `checks.ts` | Checking the JSON files' structure when they load |
| `src/content/answerSheet.ts`, `scripts/answers.ts` | Writing the answer sheet (`npm run answers`) |
| `docs/answer-sheet.md` | Every question's answers on every retake |
| `docs/visualiser-guide.md` | How the visualiser draws trees, highlights and animations |
| `tests/content/` | The tests, including every lesson plan answer in `lessonContent.test.ts` and `finalTest.test.ts` |