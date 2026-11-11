# COS750 Final Project: COS212 BST App

**Group: Out of the Blue** · COS750 Educational Software Development · University of Pretoria, 2026

A prototype of a tutor-style, pre-lecture app for COS 212 (Data Structures and Algorithms) students. It teaches **Binary Search Trees (BSTs)** to students who have never seen them, so they arrive at the lecture with the basics in place. The app ends each lesson with a low-stakes assessment that adds scaffolding when a student is struggling.

> Status: early build. The interactive wireframes (V3) are a working single-file prototype and the reference for how each screen behaves. The tree engine is being written test-first in `src/engine/`, one feature at a time; the other modules follow.

## Scope

| | |
|---|---|
| **Data structure** | Binary search tree (CS2023, Foundational Data Structures and Algorithms) |
| **Algorithms** | Search, insert and delete, with minimum/maximum and in-order, pre-order and post-order traversal as supporting operations |
| **Learners** | COS 212 students before the BST lecture. No BST knowledge assumed; arrays, linked lists, recursion and binary search are. |
| **Length** | About 85 minutes: five lessons of 12 to 18 minutes and a 10-minute final test, so students can stop and resume |

### Conventions

These come from the lesson plan, and the tree engine follows them, so every answer the app marks matches the lessons.

- Keys are whole numbers. Duplicate keys are not allowed: inserting an existing key changes nothing.
- Height counts edges, so a single node has height 0 and the empty tree -1.
- A node with two children is replaced by its in-order successor (the minimum of its right subtree).
- Pseudocode is language-neutral and recursive.
- Trees are immutable in code: every engine function returns a new tree and never changes the one it was given, so animation frames and retries can't be changed by later operations.

## App structure

| Lesson | Topic | Outcomes | Min | End-of-lesson activity |
|---|---|---|---|---|
| 1 | Trees and the BST rule | LO1, LO2 | 15 | Spot the BST |
| 2 | Search | LO3 | 12 | Find the path |
| 3 | Insert, minimum and maximum | LO4 | 15 | Grow the tree |
| 4 | Traversals | LO5 | 15 | Walk the tree |
| 5 | Delete (leaf, one child, two children) | LO6 | 18 | Remove it |
| Final | Final test on a new tree | LO1 to LO6 | 10 | n/a |

Every lesson follows the same six stages: **hook and recall → explore → explain → worked example → try it → end-of-lesson activity** (Merrill's First Principles and Kolb's cycle). Lessons unlock in order and can be revisited at any time. Students sign in, so their progress follows them between computers.

**Scaffolding and assessment**

- Hint ladder on every item: a nudge question, then a highlight on the tree, then the worked solution and a parallel item with new keys.
- 80% or more passes the activity and unlocks the next lesson. 60 to 79% shows explanations, then retries only the missed items with new keys. Below 60% re-explains the lesson in a different form before a retry.
- Retries are unlimited and no marks are shown. Retakes use new keys, made by adding a fixed offset to every key: this keeps the keys in order, so every answer stays valid, and keeps keys between 1 and 99.
- The final test has no hints and no timer. Full explanations follow the last item, and results are reported per outcome ("Secure" or "Listen for this in the lecture").

**Accessibility (UDL)**: every concept as a diagram and as text, full keyboard use, click alternatives to drag-and-drop, screen-reader announcements for animation steps, adjustable text size and contrast, a readable font option, reduced motion, sound off by default. Colour is never the only signal.

## Tech stack

JavaScript, HTML and CSS with SVG for the tree visualiser. The tree engine is written in **TypeScript**, so the engine and the content format are a type-checked agreement between the modules; the rest of the app can stay in plain JavaScript and imports the engine like any other module. Tests run on **Vitest**. Hosting on GitHub Pages is planned. *(Build setup, sign-in and progress saving to be confirmed by the integration role.)*

Planned modules:

| Module | Responsibility |
|---|---|
| Tree engine (`src/engine/`, TypeScript) | Insert, search, delete, min/max, traversals, height, successor, BST-rule check; produces animation steps |
| Content | Lesson and test data (questions, hints, explanations) as JSON. Each question stores its task, and the engine works out the answer |
| Visualiser | Tree rendering and the animation player (back, step, replay, speed) with text announcements |
| Lessons and assessment | Stage screens, question types, hint ladder, pass rules, final test and results |
| Progress | Student sign-in, saving progress and badges |

All pass thresholds, hint counts and key mappings live in one config file.

## Running locally

You need **Node.js 22.12 or later** (or 24 LTS). Check with `node -v`.

```bash
npm ci              # install exactly the versions in package-lock.json
npm test            # run the tests once
npm run test:watch  # re-run tests on every save while working on a feature
npm run typecheck   # check the TypeScript types
npm run check       # both, as CI will run them
npm run answers     # rewrite docs/answer-sheet.md after changing a lesson file
```

If npm fails with `Cannot read properties of null (reading 'edgesOut')`, that's a bug in npm. Use `npm ci`, or `npm install --legacy-peer-deps` if there's no lock file.

## Tree engine

The tree logic behind the app: pure TypeScript with no screens, storage or network. Other modules import it from `src/engine/index.ts`, never from individual files.

### Feature order

Each feature was built and fully tested before the next one started. All eleven are done, so every engine function is implemented.

| # | Feature | File | Status |
|---|---|---|---|
| 0 | Scaffold: types, file outline, reference trees | all | Done |
| 1 | Nodes and shapes | `node.ts` | Done |
| 2 | Insert and build | `insert.ts` | Done |
| 3 | Traversals | `traversal.ts` | Done |
| 4 | Search | `search.ts` | Done |
| 5 | Minimum and maximum | `extremes.ts` | Done |
| 6 | Measures: size, height, depth, leaves, parent, children, subtree | `measures.ts` | Done |
| 7 | BST rule check | `validate.ts` | Done |
| 8 | Delete and successor | `remove.ts` | Done |
| 9 | Comparing and re-keying trees | `compare.ts` | Done |
| 10 | Empty spots and allowed ranges | `slots.ts` | Done |
| 11 | Tree as text, for screen readers | `describe.ts` | Done |

### Animation steps

The step builders in `src/engine/steps/` turn an operation into a list of frames for the visualiser's player. Each `Step` is a complete snapshot: the tree, a `Highlight` saying what to emphasise, one sentence of text (shown, announced to screen readers and read aloud by narration) and the pseudocode line from `PSEUDOCODE`. The engine decides what is highlighted; the visualiser decides how it looks.

| # | Feature | File | Status |
|---|---|---|---|
| 12 | Step and highlight types, pseudocode, search and insert steps | `steps/searchSteps.ts`, `steps/insertSteps.ts` | Done |
| 13 | Build, minimum and maximum steps | `steps/buildSteps.ts`, `steps/extremeSteps.ts` | Done |
| 14 | Traversal steps and the marker walk | `steps/traversalSteps.ts` | Done |
| 15 | Delete steps | `steps/deleteSteps.ts` | Done |

## Lesson content

The five lessons and the resolver that turns them into ready-to-show lessons and questions. The lessons and assessment screens import from `src/content/index.ts`, never from individual files. The JSON lives in `src/content/data/`.

The JSON stores each question's **task** ("search T for 65"), never its computed answer. The resolver asks the engine for the answer, so answers can't be mistyped, and retakes with new keys stay correct automatically.

### What the screens call

| Call | Gives |
|---|---|
| `getLesson(n)` | Lesson `n` (1 to 5) with every stage ready: hook, explore, explain pages with diagrams and pseudocode, worked examples as animation steps, and the try-it with its answers |
| `activityQuestions(n, retake)` | The lesson's activity questions for a retake (0 is the original keys) |
| `checkPart(part, response)` / `checkQuestion(question, responses)` | Whether an answer is right. For a path, order or build it also gives `onTrack` (every step so far is right, for step-by-step confirmation) and `firstWrong`; for a set of clicks it gives `missing` and `extra` |
| `countsAsCorrect(correct, rungsShown)` | Whether a correct answer counts towards the pass mark: not once the worked solution was shown |
| `finalQuestions(retake)` | The final test's ten questions for a retake, with no hints |
| `finalResults(correct)` | The results screen from `{ itemId: true or false }`: the score, each outcome secure or not, the descriptor (Excellent, Good, Satisfactory or Limited) and a question to take to the lecture |
| `CONFIG` | The settings in `config.json` |

### The files

- **`config.json`**: the pass mark, the retry band, the hint rungs, whether an answer counts after the worked solution, the Lesson 5 delete-case rule, the retake offsets and the key range.
- **`trees.json`**: the named lesson trees, either `insert` (a list of keys) or `shape` (drawn exactly, for the invalid trees). Each tree is checked to stay within 1 to 99 on every retake.
- **`final.json`**: the final test's ten items on tree U (no hints), the six outcomes with a lecture question each, and the descriptor bands. Excellent also needs the two-children delete right, as the ID document says.
- **`lesson1.json` to `lesson5.json`**: the six stages of each lesson. Stage content always uses the original keys, so stage text uses plain numbers. Each activity item names a tree and a task (`ask`), such as `{ "kind": "searchPath", "key": 20 }`, with its prompt, two hints and explanation.
- **Keys in activity text** are written `{50}`, so a retake shifts them. Plain numbers ("3 comparisons") are left alone, and values the resolver works out are written by name, such as `{path}` or `{successor}`.
- **Hint highlights** are a preset (such as `path`, `otherHalf`, `leaves`, `rightSubtree`) or written out with retake-0 keys.

Every file is checked when it loads, and the content tests resolve every item on every retake and compare every answer with the lesson plan's tables. A mistake fails `npm test` with the file and the exact place, such as `lesson3.json: activity.items[2].ask.key must be a whole number`.

**[docs/answer-sheet.md](docs/answer-sheet.md)** lists every item's answers on every retake, for the lessons and the final test. After changing a lesson file, run `npm run answers`; a test fails if the sheet is out of date.

| # | Feature | File | Status |
|---|---|---|---|
| 16 | Settings, trees and placeholders | `config.ts`, `trees.ts`, `placeholders.ts` | Done |
| 17 | The resolver, with Lesson 2's task kinds | `resolve.ts` | Done |
| 18 | Answer checking | `check.ts` | Done |
| 19 | Task kinds for Lessons 1, 3, 4 and 5 | `kinds.ts`, `highlights.ts`, `parts.ts` | Done |
| 20 | The lesson file format, checked on load, and the stage resolver | `lessonSchema.ts`, `validateLesson.ts`, `lessons.ts` | Done |
| 21 | Lessons 1 to 5 | `data/lesson1.json` to `data/lesson5.json` | Done |
| 22 | The answer sheet | `answerSheet.ts`, `scripts/answers.ts` | Done |
| 23 | The final test and its results | `finalTest.ts`, `data/final.json` | Done |
| 24 | The content decisions, and how to change each one | `docs/` | Next |

### How each feature is built

1. Create a branch.
2. Write the tests in `tests/engine/` or `tests/content/`, using the lesson plan's answers. Run them and watch them fail.
3. Commit the failing tests: `test(engine): add insert and build tests`.
4. Write the code until the tests pass. Commit: `feat(engine): implement insert and build`.
5. Tidy the code with the tests still passing. Commit: `refactor(engine): ...` if anything changed.
6. Run `npm run check`, open a pull request and merge it.

## Testing

The answer tables in the lesson plans double as unit tests for the tree engine. Each engine feature's tests are written from them before the feature's code, so the expected answers come from the lesson plan, not from the code being tested. The reference trees are in `tests/engine/fixtures.ts`:

- **T**: insert 50, 30, 70, 20, 40, 60, 80
- **T2**: T with 45 inserted
- **U** (final test): insert 35, 20, 50, 10, 25, 45, 60, 22
- **X, V and the 55 tree**: invalid trees for Lesson 1 and the final test; **W**: a valid tree that only looks suspicious

## Documentation

| Document | Purpose |
|---|---|
| SE document | Software engineering approach, requirements, architecture, UML, testing plan |
| ID document | Instructional design: ADDIE, learning theories, learning styles, motivation, assessment design, GenAI acknowledgement |
| BST Lesson Plans V2 | Decisions, outcomes and full lesson plans; the storyboard for the coding team |
| Wireframes V3 | Clickable prototype of every screen, with design notes |
| [Answer sheet](docs/answer-sheet.md) | Every activity item's answers on every retake, generated from the lesson files |
| [Project plan](https://docs.google.com/document/d/1-fj3un0OCV_rKYq1pjEL1eJnyLQb3BT87bS_KEk9sXQ/edit?usp=sharing) | Agenda, roles, document outlines and timeline |

## Key dates

| Deliverable | Due |
|---|---|
| SE and ID documents (ClickUP) | Monday 16 November 2026, before 08:00 |
| Presentation and demo (slides on ClickUP, link to this repo) | 16 or 17 November 2026, 30-minute slot |
| Individual self-reflection reports (ClickUP) | Wednesday 18 November 2026, before 20:00 |

## Team

| Name | Student number |
|---|---|
| Marco Geral | u23584565 |
| Ethan Wilke | u23577674 |
| Nevan Rahman | u21572993 |
| Lesedi Ntsele | u25265182 |
| Unathi Dlamini | u22553402 |
| Meinka Singh | u26833213 |
| Vané Abrams | u23676150 |

Favourite Smartie colour: blue.

### Coding team roles

| Role | Owner | Code | SE document section |
|---|---|---|---|
| **Engine and content** | Ethan Wilke | Tree engine module, lesson and test content as JSON, unit tests from the answer tables, key mapping for retakes | Testing, data model |
| **Visualiser and accessibility** | Unathi Dlamini | Tree rendering, animation player (back, step, replay, speed), screen-reader announcements, keyboard support, settings | UI design, accessibility requirements |
| **Lessons and assessment** | Nevan Rahman | The six stage screens, the four question types, hint ladder, pass rules, final test, results and summary | Functional requirements, user flows |
| **Integration and repo** | Meinka Singh | Repo and CI, splitting the prototype into modules, progress saving, GitHub Pages hosting, an offline-capable demo build | Assembles the SE document: process, architecture, deployment, future work |

## Use of generative AI

Generative AI was used to help draft content, the GUI and code, as the examination specification allows. The tools and exact prompts are recorded in the ID document.