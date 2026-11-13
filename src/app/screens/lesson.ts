import {
  activityQuestions,
  checkQuestion,
  getLesson,
  CONFIG,
} from '../../content';
import type { Explore, Lesson, PartResponse, TryIt } from '../../content';
import { parentOf, search, subtree } from '../../engine';
import type { Highlight, Slot, Step, Tree } from '../../engine';
import {
  activityResult,
  feedbackFor,
  mergeRetry,
  newItem,
  recordAttempt,
} from '../../assessment';
import type { ActivityResult, ItemResult, ItemState, LessonNumber } from '../../assessment';
import { createPlayer } from '../../visualiser';
import { drawTree } from '../../visualiser';
import type { PlayerController } from '../../visualiser';
import type { Route, Screen } from '../context';
import { el } from '../dom';
import { finishActivity } from '../progressActions';
import { mountQuestionForm } from './questionForm';
import './screens.css';

const STAGES = [
  'Hook and recall',
  'Explore',
  'Explain',
  'Worked example',
  'Try it',
  'End-of-lesson activity',
] as const;

function sameSequence(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sequenceIsOnTrack(selected: readonly number[], expected: readonly number[]): boolean {
  return selected.length <= expected.length && selected.every((value, index) => value === expected[index]);
}

function sequenceFeedback(selected: readonly number[], expected: readonly number[], label: string): string {
  if (selected.length === 0) return `Select the first node in the ${label}.`;
  if (!sequenceIsOnTrack(selected, expected)) return `That choice is not on the ${label}. Undo the last choice and try again.`;
  return selected.length === expected.length
    ? `That is the complete ${label}.`
    : `That is on track. Choose the next node in the ${label}.`;
}

function sameSlot(a: Slot, b: Slot): boolean {
  return a.parent === b.parent && a.side === b.side;
}

function slotText(slot: Slot): string {
  if (slot.parent === null) return 'the root of the empty tree';
  return `the ${slot.side} side of ${slot.parent}`;
}

export const lessonScreen: Screen<Extract<Route, { name: 'lesson' }>> = (root, route, ctx) => {
  const lessonNumber = route.lesson;
  const lesson = getLesson(lessonNumber);
  const players: PlayerController[] = [];
  let stage = 0;
  let exploreIndex = 0;
  let explainIndex = 0;
  let workedIndex = 0;
  let activeRetake = ctx.store.attemptsFor(lessonNumber).length;
  let questions = activityQuestions(lessonNumber, activeRetake);
  let questionIndex = 0;
  let questionState = new Map<string, ItemState>();
  let questionRows = new Map<string, ItemResult>();
  let baseRows: ItemResult[] = [];
  let activityPhase: 'running' | 'mid' | 'low' | 'done' = 'running';
  let activityOutcome: ActivityResult | undefined;
  let questionFeedback: 'none' | 'correct' | 'nudge' | 'highlight' | 'solution' = 'none';

  function destroyPlayers(): void {
    players.splice(0).forEach((player) => player.destroy());
  }

  function addPlayer(mount: HTMLElement, steps: readonly Step[], pseudocode?: readonly string[]): void {
    if (steps.length === 0) {
      mount.append(el('p', { class: 'flow-note' }, 'There are no animation steps for this example.'));
      return;
    }
    players.push(createPlayer(mount, steps, {
      pseudocode,
      settings: ctx.store.load().settings,
      onSettingsChange: (settings) => ctx.store.saveSettings(settings),
    }));
  }

  function render(): void {
    destroyPlayers();
    root.replaceChildren();
    const body = el('section', { class: 'lesson-flow' });
    const progress = el('p', { class: 'flow-meta' }, `Lesson ${lessonNumber} of 5 · ${lesson.minutes} minutes`);
    const heading = el('h1', {}, lesson.title);
    heading.tabIndex = -1;
    const goal = el('p', { class: 'lead' }, lesson.hook.goal);
    const tabs = el('nav', { class: 'stage-tabs', 'aria-label': 'Lesson stages' });
    STAGES.forEach((name, index) => {
      const tab = el('button', {
        type: 'button',
        class: `stage-tab${index === stage ? ' stage-tab--current' : ''}`,
        'aria-current': index === stage ? 'step' : undefined,
      }, `${index + 1}. ${name}`);
      tab.addEventListener('click', () => {
        stage = index;
        render();
      });
      tabs.append(tab);
    });

    const content = el('div', { class: 'stage-content', 'aria-live': 'polite' });
    switch (stage) {
      case 0:
        renderHook(content, lesson);
        break;
      case 1:
        renderExplore(content, lesson.explore[exploreIndex], exploreIndex, lesson.explore.length);
        break;
      case 2:
        renderExplain(content, lesson, explainIndex, (next) => {
          explainIndex = next;
          render();
        });
        break;
      case 3:
        renderWorked(content, lesson, workedIndex, addPlayer, (next) => {
          workedIndex = next;
          render();
        });
        break;
      case 4:
        renderTryIt(content, lesson.tryIt, addPlayer);
        break;
      case 5:
        renderActivity(content);
        break;
    }

    const stageActions = el('div', { class: 'actions flow-stage-actions' });
    const back = el('button', { type: 'button', class: 'button' }, stage === 0 ? 'Back to lessons' : 'Previous stage');
    back.addEventListener('click', () => {
      if (stage === 0) ctx.navigate({ name: 'overview' });
      else {
        stage -= 1;
        render();
      }
    });
    stageActions.append(back);
    if (stage < STAGES.length - 1) {
      const next = el('button', { type: 'button', class: 'button button--primary' },
        stage === STAGES.length - 2 ? 'Start end-of-lesson activity' : 'Continue');
      next.addEventListener('click', () => {
        stage += 1;
        render();
      });
      stageActions.append(next);
    }

    body.append(progress, heading, goal, tabs, content, stageActions);
    root.append(body);
  }

  function renderActivity(container: HTMLElement): void {
    if (activityPhase === 'done' && activityOutcome !== undefined) {
      container.append(
        el('h2', {}, 'Lesson activity complete'),
        el('p', { class: 'flow-success', role: 'status' },
          'You passed this activity. The app has saved your progress and unlocked the next step.'),
        el('p', {}, 'No mark is shown. You can revisit this lesson any time.'),
        el('div', { class: 'actions' },
          actionButton('Continue to lessons', () => ctx.navigate({ name: 'overview' }), true)),
      );
      return;
    }

    if (activityPhase === 'mid' || activityPhase === 'low') {
      const missed = baseRows.filter((row) => !row.scored);
      container.append(
        el('h2', {}, activityPhase === 'mid' ? 'Review and retry' : 'Let’s go over the idea again'),
        el('p', {}, activityPhase === 'mid'
          ? 'You’re close. Review the explanations below, then retry only the missed items with new keys.'
          : 'Take another look at these lesson ideas in a different form, then try the full activity again with new keys.'),
      );
      if (activityPhase === 'mid') {
        missed.forEach((row) => {
          const question = questions.find((entry) => entry.id === row.id);
          if (question !== undefined) {
            container.append(el('article', { class: 'flow-review' },
              el('h3', {}, question.prompt),
              el('p', {}, question.explanation)));
          }
        });
      } else {
        for (const page of lesson.explain.pages) {
          const recap = el('article', { class: 'flow-review' }, el('h3', {}, page.title));
          page.steps?.forEach((text) => recap.append(el('p', {}, text)));
          page.caption && recap.append(el('p', {}, page.caption));
          page.note && recap.append(el('p', {}, page.note));
          if (page.diagram !== undefined) {
            const diagram = el('div', { class: 'flow-tree' });
            recap.append(diagram);
            drawTree(diagram, page.diagram.tree, page.diagram.highlight);
          }
          container.append(recap);
        }
      }
      container.append(
        el('p', { class: 'flow-note' }, activityOutcome?.caseRuleMet === false
          ? 'For this lesson, the pass rule also requires a scored item for each deletion case.'
          : ''),
        actionButton(activityPhase === 'mid' ? 'Retry missed items with new keys' : 'Retry the activity with new keys', beginRetry, true),
        actionButton('Return to lessons', () => ctx.navigate({ name: 'overview' })),
      );
      return;
    }

    const question = questions[questionIndex];
    if (question === undefined) {
      container.append(el('p', { role: 'alert' }, 'The activity question could not be loaded.'));
      return;
    }
    const state = questionState.get(question.id) ?? newItem();
    questionState.set(question.id, state);
    container.append(
      el('h2', {}, lesson.activity.title),
      el('p', { class: 'flow-meta' }, `Question ${questionIndex + 1} of ${questions.length} · ${question.outcome}`),
      el('p', { class: 'flow-prompt' }, question.prompt),
    );
    if (question.intro !== undefined) container.append(el('p', { class: 'flow-note' }, question.intro));

    const hint = state.rung > 0 && state.rung < CONFIG.hintRungs
      ? question.hints[state.rung - 1]
      : undefined;
    if (questionFeedback === 'nudge' || questionFeedback === 'highlight') {
      container.append(el('p', { class: 'flow-hint', role: 'status' },
        hint?.text ?? 'Try another approach. Think about the rule from this lesson.'));
    }

    if (questionFeedback === 'correct') {
      container.append(
        el('p', { class: 'flow-success', role: 'status' }, 'That’s right.'),
        el('p', {}, question.explanation),
      );
      if (question.result !== undefined) {
        const resultTree = el('div', { class: 'flow-tree' });
        container.append(el('h3', {}, 'Result'), resultTree);
        drawTree(resultTree, question.result.tree, question.result.highlight);
      }
      if (question.bridge !== undefined) container.append(el('p', { class: 'flow-note' }, question.bridge));
      container.append(actionButton(questionIndex + 1 < questions.length ? 'Next question' : 'Finish activity', advanceQuestion, true));
      return;
    }

    if (questionFeedback === 'solution') {
      container.append(
        el('p', { class: 'flow-hint', role: 'status' }, 'Here is the worked solution. Then try a parallel question with new keys.'),
        el('p', {}, question.explanation),
      );
      const solution = el('div', { class: 'flow-player' });
      container.append(solution);
      addPlayer(solution, question.solution);
      container.append(actionButton('Try a parallel question', tryParallel, true));
      return;
    }

    const formMount = el('div');
    container.append(formMount);
    mountQuestionForm(formMount, question, onAnswer, {
      highlight: questionFeedback === 'highlight' ? hint?.highlight : undefined,
    });
  }

  function onAnswer(responses: readonly PartResponse[]): void {
    const question = questions[questionIndex];
    if (question === undefined) return;
    const checked = checkQuestion(question, responses);
    const state = questionState.get(question.id) ?? newItem();
    if (checked.correct) {
      const next = recordAttempt(state, true);
      questionState.set(question.id, next);
      questionRows.set(question.id, {
        id: question.id,
        scored: next.scored,
        ...(question.deleteCase === undefined ? {} : { deleteCase: question.deleteCase }),
      });
      questionFeedback = 'correct';
    } else {
      const next = recordAttempt(state, false);
      questionState.set(question.id, next);
      questionFeedback = feedbackFor(next);
    }
    render();
  }

  function advanceQuestion(): void {
    if (questionIndex + 1 < questions.length) {
      questionIndex += 1;
      questionFeedback = 'none';
      render();
      return;
    }
    completeRound();
  }

  function completeRound(): void {
    const currentRows = questions.map((question) => questionRows.get(question.id) ?? {
      id: question.id,
      scored: false,
      ...(question.deleteCase === undefined ? {} : { deleteCase: question.deleteCase }),
    });
    baseRows = baseRows.length > 0 ? mergeRetry(baseRows, currentRows) : currentRows;
    activityOutcome = activityResult(baseRows, lessonNumber);
    finishActivity(ctx, lessonNumber, activityOutcome);
    activityPhase = activityOutcome.band === 'pass' ? 'done' : activityOutcome.band;
    render();
  }

  function beginRetry(): void {
    const retryIds = activityPhase === 'mid'
      ? new Set(baseRows.filter((row) => !row.scored).map((row) => row.id))
      : undefined;
    activeRetake += 1;
    questions = activityQuestions(lessonNumber, activeRetake)
      .filter((question) => retryIds === undefined || retryIds.has(question.id));
    if (questions.length === 0) {
      throw new Error('The activity has no items to retry');
    }
    questions.forEach((question) => {
      questionState.delete(question.id);
      questionRows.delete(question.id);
    });
    questionIndex = 0;
    questionFeedback = 'none';
    activityPhase = 'running';
    render();
  }

  function tryParallel(): void {
    const old = questions[questionIndex];
    if (old === undefined) return;
    activeRetake += 1;
    const replacement = activityQuestions(lessonNumber, activeRetake).find((item) => item.id === old.id);
    if (replacement === undefined) throw new Error(`Could not resolve a parallel version of "${old.id}"`);
    questions = questions.map((item, index) => index === questionIndex ? replacement : item);
    questionState.set(replacement.id, newItem());
    questionRows.set(replacement.id, { id: replacement.id, scored: false, ...(replacement.deleteCase === undefined ? {} : { deleteCase: replacement.deleteCase }) });
    questionFeedback = 'none';
    render();
  }

  function renderHook(container: HTMLElement, current: Lesson): void {
    const { scenario, warmUp } = current.hook;
    container.append(
      el('h2', {}, 'Hook and recall'),
      el('article', { class: 'flow-card' },
        el('h3', {}, scenario.title),
        el('p', {}, scenario.text),
        scenario.recall ? el('p', {}, scenario.recall) : null,
        scenario.reveal ? el('details', {}, el('summary', {}, 'See the connection'), el('p', {}, scenario.reveal)) : null),
    );
    if (warmUp.tree !== undefined) {
      const tree = el('div', { class: 'flow-tree' });
      container.append(tree);
      drawTree(tree, warmUp.tree);
    }
    const options = el('fieldset', { class: 'flow-choices' }, el('legend', {}, warmUp.question));
    const feedback = el('p', { role: 'status', class: 'flow-feedback' });
    warmUp.options.forEach((option, index) => {
      const choice = el('button', { type: 'button', class: 'button' }, option.text);
      choice.addEventListener('click', () => {
        feedback.textContent = option.reply;
        options.querySelectorAll('button').forEach((button) => { button.disabled = true; });
        if (index === warmUp.answer) feedback.classList.add('flow-success');
      });
      options.append(choice);
    });
    container.append(options, feedback, el('p', { class: 'flow-goal' }, `Lesson goal: ${current.hook.goal}`));
    if (current.hook.bridge !== undefined) container.append(el('p', { class: 'flow-note' }, current.hook.bridge));
  }

  function renderExplore(container: HTMLElement, item: Explore | undefined, index: number, total: number): void {
    container.append(el('h2', {}, 'Explore'), el('p', { class: 'flow-meta' }, `Explore activity ${index + 1} of ${total}`));
    if (item === undefined) {
      container.append(el('p', {}, 'This lesson has no explore activity.'));
      return;
    }
    const status = el('p', { role: 'status', class: 'flow-feedback' });
    switch (item.kind) {
      case 'relatives': {
        container.append(el('p', {}, `Choose a node. Explore its place in the tree. You need to inspect ${item.need} node${item.need === 1 ? '' : 's'}.`));
        const mount = el('div', { class: 'flow-tree' });
        const inspected = new Set<number>();
        let highlight: Highlight = {};
        container.append(mount, status);
        const draw = () => drawTree(mount, item.tree, highlight, {
          onNode: (key) => {
            if (inspected.has(key)) {
              status.textContent = `You have already inspected ${key}. Choose a different node (${inspected.size} of ${item.need}).`;
              return;
            }
            inspected.add(key);
            const route = search(item.tree, key).path;
            const parent = parentOf(item.tree, key);
            const node = subtree(item.tree, key);
            const children = [node?.left?.key, node?.right?.key].filter((child): child is number => child !== undefined);
            const edges = route.slice(1).map((child, i) => [route[i]!, child] as const);
            highlight = { current: key, outlined: children, edges };
            const relation = `${key} is ${parent === null ? 'the root' : `a child of ${parent}`}${children.length ? `, with ${children.join(' and ')} as its child${children.length > 1 ? 'ren' : ''}` : ', and has no children'}.`;
            status.textContent = inspected.size < item.need
              ? `${relation} Inspected ${inspected.size} of ${item.need}; choose another node.`
              : `${relation} You have inspected ${item.need} nodes.`;
            draw();
          },
        });
        draw();
        break;
      }
      case 'pickTree': {
        container.append(el('p', {}, item.prompt));
        item.trees.forEach((option, optionIndex) => {
          const choose = el('button', { type: 'button', class: 'button' }, option.label);
          choose.addEventListener('click', () => {
            const mount = container.querySelector<HTMLElement>('.explore-choice-tree');
            if (mount) drawTree(mount, option.tree);
            status.textContent = optionIndex === item.answer ? item.reveal : `Look at the rule: ${item.reveal}`;
          });
          container.append(choose);
        });
        const treeMount = el('div', { class: 'flow-tree explore-choice-tree' });
        container.append(treeMount, status);
        break;
      }
      case 'freeSearch': {
        let path: number[] = [];
        const mount = el('div', { class: 'flow-tree' });
        const picked = el('p', { class: 'answer-sequence', 'aria-live': 'polite' }, 'Path: not started');
        const check = actionButton('Check path', () => {
          status.textContent = sameSequence(path, item.path)
            ? `That is the search path for ${item.key}.`
            : `Not quite. Use the BST rule to check your path for ${item.key}, then undo or start again.`;
        });
        const undo = actionButton('Undo last node', () => {
          path.pop();
          picked.textContent = path.length ? `Path: ${path.join(', ')}` : 'Path: not started';
          status.textContent = sequenceFeedback(path, item.path, 'search path');
          draw();
        });
        const draw = () => drawTree(mount, item.tree, { visited: path }, {
          selected: path,
          numbered: true,
          onNode: (key) => {
            if (path.length >= item.path.length) return;
            path = [...path, key];
            picked.textContent = `Path: ${path.join(', ')}`;
            status.textContent = sequenceFeedback(path, item.path, 'search path');
            draw();
          },
        });
        container.append(el('p', {}, `Find ${item.key}. Click each node the search visits.`), mount, picked, el('div', { class: 'actions' }, check, undo), status);
        draw();
        break;
      }
      case 'slotProbe': {
        const mount = el('div', { class: 'flow-tree' });
        container.append(el('p', {}, `Find the empty spot where ${item.key} belongs.`), mount, status);
        drawTree(mount, item.tree, {}, {
          showSlots: true,
          onSlot: (slot) => {
            const correct = sameSlot(slot, item.slot);
            status.textContent = correct
              ? `Yes. ${item.key} belongs at ${slotText(slot)}.`
              : `That spot is not where a search for ${item.key} stops. Try again.`;
          },
        });
        break;
      }
      case 'walk': {
        const mount = el('div', { class: 'flow-player' });
        container.append(el('p', {}, 'Watch the marker pass each node before, between and after its children.'), mount);
        addPlayer(mount, item.steps);
        break;
      }
      case 'orderGuess': {
        container.append(el('p', {}, `Put the node cards in ${item.order}-order by selecting them in sequence.`));
        const mount = el('div', { class: 'flow-tree' });
        const picked = el('p', { class: 'answer-sequence', 'aria-live': 'polite' }, 'Your sequence: not started');
        const cards = el('div', { class: 'answer-cards' });
        let selected: number[] = [];
        const draw = () => drawTree(mount, item.tree, {}, { selected, numbered: true });
        const drawCards = () => {
          cards.replaceChildren(...[...item.answer].reverse()
            .filter((key) => !selected.includes(key))
            .map((key) => {
              const choose = actionButton(String(key), () => {
                if (selected.length >= item.answer.length) return;
                selected = [...selected, key];
                update();
              });
              choose.classList.add('answer-card');
              return choose;
            }));
        };
        const update = () => {
          picked.textContent = selected.length ? `Your sequence: ${selected.join(', ')}` : 'Your sequence: not started';
          status.textContent = sequenceFeedback(selected, item.answer, `${item.order}-order traversal`);
          draw();
          drawCards();
        };
        const check = actionButton('Check order', () => {
          status.textContent = sameSequence(selected, item.answer)
            ? 'Correct order. Notice when each node is visited.'
            : `Not quite. Review when each node is visited, then undo or start again.`;
        });
        const undo = actionButton('Undo last node', () => {
          selected.pop();
          update();
        });
        const clear = actionButton('Start again', () => {
          selected = [];
          update();
        });
        container.append(mount, cards, picked, el('div', { class: 'actions' }, check, undo, clear), status);
        drawCards();
        draw();
        break;
      }
      case 'deleteTry': {
        let caseIndex = 0;
        const caseArea = el('div');
        const tabs = el('div', { class: 'answer-cards' });
        item.cases.forEach((entry, entryIndex) => {
          const tab = actionButton(`Case ${entryIndex + 1}: ${entry.label}`, () => {
            caseIndex = entryIndex;
            showCase();
          });
          tabs.append(tab);
        });
        const showCase = () => {
          const entry = item.cases[caseIndex];
          if (entry === undefined) return;
          const treeMount = el('div', { class: 'flow-tree' });
          caseArea.replaceChildren(
            el('h3', {}, entry.label),
            el('p', {}, `What should happen when ${entry.key} is removed?`),
            treeMount,
          );
          drawTree(treeMount, entry.tree, { current: entry.key });
          entry.options.forEach((option) => {
            const choose = el('button', { type: 'button', class: 'button' }, option.text);
            choose.addEventListener('click', () => {
              const explanation = el('p', { role: 'status', class: option.valid ? 'flow-success' : 'flow-hint' },
                option.possible ? option.valid ? 'This move keeps the BST rule.' : 'This move does not keep the BST rule.' : 'This move is not possible without losing part of the tree.');
              const resultMount = el('div', { class: 'flow-tree' });
              caseArea.append(explanation, resultMount);
              if (option.possible) drawTree(resultMount, option.result);
              if (entry.note !== undefined) caseArea.append(el('p', {}, entry.note));
            });
            caseArea.append(choose);
          });
        };
        container.append(el('p', {}, 'Try each deletion case and compare the possible moves.'), tabs, caseArea);
        showCase();
        break;
      }
      case 'reflect': {
        container.append(el('p', {}, item.prompt));
        item.options.forEach((option, optionIndex) => {
          const choose = el('button', { type: 'button', class: 'button' }, option.text);
          choose.addEventListener('click', () => {
            status.textContent = option.reply;
            if (item.answer === null || item.answer === optionIndex) status.classList.add('flow-success');
          });
          container.append(choose);
        });
        container.append(status);
        break;
      }
    }
    if (total > 1) {
      const controls = el('div', { class: 'actions' });
      if (index > 0) controls.append(actionButton('Previous explore', () => {
        exploreIndex = Math.max(0, exploreIndex - 1);
        render();
      }));
      if (index + 1 < total) controls.append(actionButton('Next explore', () => {
        exploreIndex += 1;
        render();
      }));
      container.append(controls);
    }
  }

  function renderExplain(
    container: HTMLElement,
    current: Lesson,
    index: number,
    setIndex: (next: number) => void,
  ): void {
    const page = current.explain.pages[index];
    container.append(el('h2', {}, 'Explain'), el('p', { class: 'flow-meta' }, `Page ${index + 1} of ${current.explain.pages.length}`));
    if (page === undefined) return;
    container.append(el('h3', {}, page.title));
    if (page.terms !== undefined) {
      for (const group of page.terms) {
        container.append(el('h4', {}, group.group));
        const list = el('dl', { class: 'term-list' });
        group.items.forEach(({ term, meaning }) => list.append(el('dt', {}, term), el('dd', {}, meaning)));
        container.append(list);
      }
    }
    if (page.steps !== undefined) container.append(el('ol', { class: 'flow-steps' }, ...page.steps.map((text) => el('li', {}, text))));
    if (page.note !== undefined) container.append(el('p', { class: 'flow-note' }, page.note));
    if (page.diagram !== undefined) {
      const diagram = el('div', { class: 'flow-tree' });
      container.append(diagram);
      drawTree(diagram, page.diagram.tree, page.diagram.highlight);
    }
    if (page.caption !== undefined) container.append(el('p', {}, page.caption));
    if (page.pseudocode !== undefined) {
      container.append(
        el('details', { class: 'flow-pseudocode' },
          el('summary', {}, 'Show pseudocode'),
          el('ol', {}, ...page.pseudocode.lines.map((line) => el('li', {}, line)))),
      );
    }
    const actions = el('div', { class: 'actions' });
    if (index > 0) actions.append(actionButton('Previous explanation', () => setIndex(index - 1)));
    if (index + 1 < current.explain.pages.length) actions.append(actionButton('Next explanation', () => setIndex(index + 1)));
    container.append(actions);
  }

  function renderWorked(
    container: HTMLElement,
    current: Lesson,
    index: number,
    player: typeof addPlayer,
    setIndex: (next: number) => void,
  ): void {
    const example = current.worked.examples[index];
    container.append(el('h2', {}, 'Worked example'), el('p', { class: 'flow-meta' }, `Example ${index + 1} of ${current.worked.examples.length}`));
    if (example === undefined) return;
    container.append(el('h3', {}, example.label));
    if (example.deleteCase !== undefined) container.append(el('p', { class: 'flow-note' }, `Deletion case: ${example.deleteCase}.`));
    const playerMount = el('div', { class: 'flow-player' });
    container.append(playerMount);
    player(playerMount, example.steps, example.pseudocode?.lines);
    const actions = el('div', { class: 'actions' });
    if (index > 0) actions.append(actionButton('Previous example', () => setIndex(index - 1)));
    if (index + 1 < current.worked.examples.length) actions.append(actionButton('Next example', () => setIndex(index + 1)));
    container.append(actions);
  }

  function renderTryIt(container: HTMLElement, task: TryIt, player: typeof addPlayer): void {
    container.append(el('h2', {}, 'Try it'), el('h3', {}, task.title));
    if (task.kind === 'search' || task.kind === 'insert') {
      const mount = el('div', { class: 'flow-tree' });
      const status = el('p', { role: 'status', class: 'flow-feedback' });
      const sequence = el('p', { class: 'answer-sequence', 'aria-live': 'polite' }, 'Path: not started');
      const solutionMount = el('div', { class: 'flow-player' });
      let selected: number[] = [];
      let mode: 'path' | 'slot' = 'path';
      let selectedSlot: Slot | undefined;
      let undo: HTMLButtonElement;
      const redraw = () => {
        drawTree(mount, task.tree, mode === 'slot' && task.kind === 'insert' ? { slot: task.slot } : {}, {
          selected,
          numbered: true,
          showSlots: mode === 'slot' && task.kind === 'insert',
          onNode: (key) => {
            if (mode === 'path' && selected.length < task.path.length) {
              selected.push(key);
              sequence.textContent = `Path: ${selected.join(', ')}`;
              status.textContent = sequenceFeedback(selected, task.path, 'search path');
              redraw();
            }
          },
          onSlot: (slot) => {
            if (task.kind !== 'insert') return;
            selectedSlot = slot;
            status.textContent = sameSlot(slot, task.slot)
              ? `${task.key} belongs at ${slotText(slot)}.`
              : `That is not the empty spot reached by a search for ${task.key}.`;
            finish.hidden = false;
          },
        });
        undo.hidden = mode !== 'path';
      };
      const pathDone = actionButton('I have followed the path', () => {
        const expected = task.path;
        if (!sameSequence(selected, expected)) {
          status.textContent = 'Not quite. Use the BST rule to check each comparison, then undo or start again.';
          return;
        }
        if (task.kind === 'search') {
          status.textContent = task.found
            ? `Correct path. The search finds ${task.key}.`
            : `Correct path. The search for ${task.key} ends at an empty spot.`;
          player(solutionMount, task.solution);
        } else {
          mode = 'slot';
          pathDone.hidden = true;
          status.textContent = `Now choose the empty spot for ${task.key}.`;
          redraw();
        }
      });
      const finish = actionButton(task.kind === 'search' ? 'Show the worked search' : 'Check insertion spot', () => {
        if (task.kind === 'insert' && selectedSlot !== undefined && !sameSlot(selectedSlot, task.slot)) {
          status.textContent = `The correct spot is ${slotText(task.slot)}.`;
        }
        player(solutionMount, task.solution);
      });
      finish.hidden = true;
      const reset = actionButton('Start again', () => {
        selected = [];
        selectedSlot = undefined;
        mode = 'path';
        status.textContent = '';
        sequence.textContent = 'Path: not started';
        solutionMount.replaceChildren();
        redraw();
      });
      undo = actionButton('Undo last node', () => {
      selected.pop();
      sequence.textContent = selected.length ? `Path: ${selected.join(', ')}` : 'Path: not started';
      status.textContent = sequenceFeedback(selected, task.path, 'search path');
      redraw();
      });
      undo.hidden = true;
      container.append(
      el('p', {}, task.kind === 'search' ? `Click the nodes visited when searching for ${task.key}.` : `Click the search path for ${task.key}, then choose its empty spot.`),
      mount,
      sequence,
      el('div', { class: 'actions' }, pathDone, finish, undo, reset),
      status,
      solutionMount,
      );
      redraw();
      return;
    }

    if (task.kind === 'traversal') {
      const mount = el('div', { class: 'flow-tree' });
      const cards = el('div', { class: 'answer-cards' });
      const output = el('p', { class: 'answer-sequence', 'aria-live': 'polite' }, 'Your order: not started');
      const status = el('p', { role: 'status', class: 'flow-feedback' });
      const solutionMount = el('div', { class: 'flow-player' });
      let selected: number[] = [];
      const draw = () => drawTree(mount, task.tree, {}, {
        selected,
        numbered: true,
        onNode: (key) => {
          if (!selected.includes(key)) {
            if (selected.length >= task.sequence.length) return;
            selected = [...selected, key];
            output.textContent = `Your order: ${selected.join(', ')}`;
            status.textContent = sequenceFeedback(selected, task.sequence, `${task.order}-order traversal`);
            draw();
          }
        },
      });
      const check = actionButton('Check traversal', () => {
        const correct = sameSequence(selected, task.sequence);
        status.textContent = correct
          ? 'Correct traversal order.'
          : 'Not quite. Review when each node is visited, then undo or start again.';
        player(solutionMount, task.solution);
      });
      const undo = actionButton('Undo last node', () => {
        selected.pop();
        output.textContent = selected.length ? `Your order: ${selected.join(', ')}` : 'Your order: not started';
        status.textContent = sequenceFeedback(selected, task.sequence, `${task.order}-order traversal`);
        draw();
      });
      const reset = actionButton('Start again', () => {
        selected = [];
        output.textContent = 'Your order: not started';
        status.textContent = sequenceFeedback(selected, task.sequence, `${task.order}-order traversal`);
        solutionMount.replaceChildren();
        draw();
      });
      container.append(mount, output, el('div', { class: 'actions' }, check, undo, reset), status, solutionMount);
      draw();
      return;
    }

    const guided = el('div', { class: 'guided-flow' });
    container.append(guided);
    renderGuided(guided, task);
  }

  function renderGuided(container: HTMLElement, task: Extract<TryIt, { kind: 'guided' }>): void {
    let stepIndex = 0;
    const drawStep = () => {
      const step = task.steps[stepIndex];
      if (step === undefined) {
        container.replaceChildren(el('p', { class: 'flow-success', role: 'status' }, 'You completed this guided activity.'));
        return;
      }
      const treeMount = el('div', { class: 'flow-tree' });
      const status = el('p', { role: 'status', class: 'flow-feedback' });
      const afterMount = el('div', { class: 'flow-tree' });
      const next = actionButton(stepIndex + 1 < task.steps.length ? 'Continue' : 'Finish guided activity', () => {
        stepIndex += 1;
        drawStep();
      }, true);
      next.hidden = true;
      const content = el('div', { class: 'guided-step' },
        el('p', { class: 'flow-meta' }, `Guided step ${stepIndex + 1} of ${task.steps.length}`),
        el('p', {}, step.prompt),
        treeMount,
        status);
      if (step.ask === 'node') {
        content.append(el('p', { class: 'question-help' }, 'Select the node on the tree.'));
        drawTree(treeMount, task.tree, step.highlight, {
          onNode: (key) => {
            if (step.accept.includes(key)) {
              status.textContent = step.right;
              status.classList.add('flow-success');
              drawTree(treeMount, task.tree, {
                ...step.highlight,
                found: key,
                ...(step.tag ? { tags: { [key]: step.tag } } : {}),
              });
              next.hidden = false;
            } else {
              status.textContent = step.wrong;
              status.classList.remove('flow-success');
            }
          },
        });
      } else {
        drawTree(treeMount, task.tree, step.highlight);
        step.options.forEach((option, index) => {
          const choose = actionButton(option, () => {
            if (index === step.answer) {
              status.textContent = step.right;
              status.classList.add('flow-success');
              if (step.after !== undefined) drawTree(afterMount, step.after.tree, step.after.highlight);
              next.hidden = false;
            } else {
              status.textContent = step.wrong;
              status.classList.remove('flow-success');
            }
          });
          content.append(choose);
        });
      }
      content.append(next, afterMount);
      container.replaceChildren(content);
    };
    if (task.steps.length === 0) {
      container.append(el('p', {}, 'There are no guided steps in this activity.'));
    } else {
      drawStep();
    }
  }

  function actionButton(label: string, action: () => void, primary = false): HTMLButtonElement {
    const button = el('button', { type: 'button', class: `button${primary ? ' button--primary' : ''}` }, label);
    button.addEventListener('click', action);
    return button;
  }

  render();
  return destroyPlayers;
};
