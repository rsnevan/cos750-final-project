# COS750 Final Project: COS212 BST App

**Group: Out of the Blue** · COS750 Educational Software Development · University of Pretoria, 2026

A prototype of a tutor-style, pre-lecture app for COS 212 (Data Structures and Algorithms) students. It teaches **Binary Search Trees (BSTs)** to students who have never seen them, so they arrive at the lecture with the basics in place. The app ends each lesson with a low-stakes assessment that adds scaffolding when a student is struggling.

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

JavaScript, HTML and CSS with SVG for the tree visualiser. The tree engine is written in **TypeScript**, so the engine and the content format are a type-checked agreement between the modules. Tests run on **Vitest**. Hosting on GitHub Pages is planned. *(Build setup, sign-in and progress saving to be confirmed by the integration role.)*

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
```


## Tree engine

The tree logic behind the app: pure TypeScript with no screens, storage or network. Other modules import it from `src/engine/index.ts`, never from individual files.

### Feature order

Each feature is built and fully tested before the next one starts. Functions that aren't written yet throw `NotImplementedError`.

| # | Feature | File | Status |
|---|---|---|---|
| 0 | Scaffold: types, file outline, reference trees | all | Done |
| 1 | Nodes and shapes | `node.ts` | To do |
| 2 | Insert and build | `insert.ts` | To do |
| 3 | Traversals | `traversal.ts` | To do |
| 4 | Search | `search.ts` | To do |
| 5 | Minimum and maximum | `extremes.ts` | To do |
| 6 | Measures: size, height, depth, leaves, parent, children, subtree | `measures.ts` | To do |
| 7 | BST rule check | `validate.ts` | To do |
| 8 | Delete and successor | `remove.ts` | To do |
| 9 | Comparing and re-keying trees | `compare.ts` | To do |
| 10 | Empty spots and allowed ranges | `slots.ts` | To do |
| 11 | Tree as text, for screen readers | `describe.ts` | To do |

Animation steps, the content format and the retake resolver come after the engine.

### How each feature is built

1. Create a branch: `git switch -c engine/02-insert`.
2. Write the tests in `tests/engine/<feature>.test.ts`, using the lesson plan's answers. Run them and watch them fail.
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