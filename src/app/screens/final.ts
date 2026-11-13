import { FINAL_TEST, finalQuestions, finalResults, getTree, checkQuestion } from '../../content';
import type { FinalResults, PartResponse, Question } from '../../content';
import { createPlayer, drawTree } from '../../visualiser';
import type { PlayerController } from '../../visualiser';
import type { Route, Screen } from '../context';
import { el } from '../dom';
import { finishFinalTest } from '../progressActions';
import { mountQuestionForm } from './questionForm';
import './screens.css';

export const finalScreen: Screen<Extract<Route, { name: 'final' }>> = (root, _route, ctx) => {
  let retake = ctx.store.attemptsFor('final').length;
  let questions = finalQuestions(retake);
  let index = 0;
  let started = false;
  let results: FinalResults | undefined;
  const correctById: Record<string, boolean> = {};
  const players: PlayerController[] = [];

  function destroyPlayers(): void {
    players.splice(0).forEach((player) => player.destroy());
  }

  function render(): void {
    destroyPlayers();
    root.replaceChildren();
    const body = el('section', { class: 'final-flow' });
    const heading = el('h1', {}, results === undefined ? FINAL_TEST.title : 'Final test results');
    heading.tabIndex = -1;
    body.append(heading);

    if (results !== undefined) {
      renderResults(body, results);
      root.append(body);
      return;
    }

    const treeMount = el('div', { class: 'flow-tree', 'aria-label': 'Reference tree U' });
    drawTree(treeMount, getTree('U'));

    if (!started) {
      body.append(
        el('p', { class: 'lead' }, FINAL_TEST.summary),
        el('p', { class: 'flow-note' }, retake === 0 ? FINAL_TEST.firstNote : FINAL_TEST.retakeNote),
        el('p', { class: 'flow-meta' }, `${FINAL_TEST.items.length} questions · ${FINAL_TEST.minutes} minutes suggested · no timer or hints`),
        treeMount,
        el('div', { class: 'actions' },
          el('button', { type: 'button', class: 'button' }, 'Back to all lessons'),
          startButton()),
      );
      const back = body.querySelector<HTMLButtonElement>('.actions button');
      back?.addEventListener('click', () => ctx.navigate({ name: 'overview' }));
      root.append(body);
      return;
    }

    const question = questions[index];
    if (question === undefined) throw new Error(`Final test question ${index + 1} is missing`);
    const mount = el('div', { class: 'final-question' });
    body.append(
      el('p', { class: 'flow-meta' }, `Question ${index + 1} of ${questions.length}`),
      el('p', { class: 'flow-note' }, FINAL_TEST.banner),
      treeMount,
      el('p', { class: 'flow-prompt' }, question.prompt),
      mount,
    );
    mountQuestionForm(mount, question, (responses) => submit(question, responses));
    root.append(body);
  }

  function startButton(): HTMLButtonElement {
    const button = el('button', { type: 'button', class: 'button button--primary' }, 'Start final test');
    button.addEventListener('click', () => {
      started = true;
      render();
    });
    return button;
  }

  function submit(question: Question, responses: readonly PartResponse[]): void {
    correctById[question.id] = checkQuestion(question, responses).correct;
    index += 1;
    if (index === questions.length) {
      results = finalResults(correctById);
      const missed = questions.filter((item) => !correctById[item.id]).map((item) => item.id);
      finishFinalTest(ctx, missed);
    }
    render();
  }

  function renderResults(container: HTMLElement, summary: FinalResults): void {
    const status = `${summary.score} of ${summary.total} correct`;
    container.append(
      el('p', { class: 'lead' }, status),
      el('section', { class: 'flow-card' },
        el('h2', {}, summary.descriptor.name),
        el('p', {}, summary.descriptor.meaning)),
      el('section', { class: 'flow-card' },
        el('h2', {}, 'Outcomes'),
        el('ul', {}, ...summary.outcomes.map((outcome) =>
          el('li', {}, `${outcome.name}: ${outcome.secure ? 'secure' : 'not yet secure'}`)))),
      el('section', { class: 'flow-card' },
        el('h2', {}, 'For the lecture'),
        el('p', {}, summary.lectureQuestion)),
      el('h2', {}, 'Question review'),
      ...questions.map((question) => {
        const isCorrect = correctById[question.id] === true;
        const review = el('section', { class: 'flow-review' },
          el('h3', {}, `${isCorrect ? 'Correct' : 'Review'} · ${question.prompt}`),
          el('p', {}, question.explanation));
        if (!isCorrect && question.misconception !== undefined) {
          review.append(el('p', { class: 'flow-note' }, question.misconception));
        }
        if (question.result !== undefined) {
          const resultTree = el('div', { class: 'flow-tree' });
          review.append(el('h4', {}, 'Resulting tree'), resultTree);
          drawTree(resultTree, question.result.tree, question.result.highlight);
        }
        if (question.solution.length > 0) {
          const replay = el('div', { class: 'flow-player' });
          review.append(el('h4', {}, 'Worked solution'), replay);
          players.push(createPlayer(replay, question.solution, {
            settings: ctx.store.load().settings,
            onSettingsChange: (settings) => ctx.store.saveSettings(settings),
          }));
        }
        return review;
      }),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'button' }, 'Back to all lessons'),
        el('button', { type: 'button', class: 'button button--primary' }, 'Retake final test')),
    );
    const buttons = container.querySelectorAll<HTMLButtonElement>('.actions button');
    buttons[0]?.addEventListener('click', () => ctx.navigate({ name: 'overview' }));
    buttons[1]?.addEventListener('click', () => {
      retake = ctx.store.attemptsFor('final').length;
      questions = finalQuestions(retake);
      index = 0;
      started = true;
      results = undefined;
      for (const id of Object.keys(correctById)) delete correctById[id];
      render();
    });
  }

  render();
  return destroyPlayers;
};
