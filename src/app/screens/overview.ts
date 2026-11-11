/**
  Overview: the lesson map, badges, a Continue button and moving progress
  to another computer.
 */
import { LESSON_NUMBERS, isLessonUnlocked, isTestUnlocked, nextStep } from '../../assessment';
import type { Badge } from '../../assessment';
import { getLesson, FINAL_TEST } from '../../content';
import type { Screen } from '../context';
import { el } from '../dom';

// Badge labels come from the lesson content, so the content team can rename them.
function badgeName(badge: Badge): string {
  if (badge === 'bst-ready') return 'BST ready';
  const n = Number(badge.slice('lesson-'.length)) as 1 | 2 | 3 | 4 | 5;
  return `Lesson ${n}: ${getLesson(n).short}`;
}

export const overviewScreen: Screen = (root, _route, ctx) => {
  const { progress } = ctx.store.load();
  const next = nextStep(progress);

  const continueLabel =
    next.kind === 'lesson' ? (progress.passed.length === 0 ? 'Start Lesson 1' : `Continue with Lesson ${next.lesson}`)
    : next.kind === 'test' ? 'Take the final test'
    : 'Review any lesson';
  const continueButton = el('button', { class: 'button button--primary', type: 'button' }, continueLabel);
  continueButton.addEventListener('click', () => {
    if (next.kind === 'lesson') ctx.navigate({ name: 'lesson', lesson: next.lesson });
    else if (next.kind === 'test') ctx.navigate({ name: 'final' });
    else ctx.navigate({ name: 'lesson', lesson: 1 });
  });

  const list = el('ol', { class: 'lesson-map' });
  for (const n of LESSON_NUMBERS) {
    const lesson = getLesson(n);
    const unlocked = isLessonUnlocked(progress, n);
    const done = progress.passed.includes(n);
    const status = done ? 'Done' : unlocked ? 'Ready' : 'Locked';
    const title = unlocked
      ? el('a', { href: `#/lesson/${n}` }, `Lesson ${n}: ${lesson.title}`)
      : el('span', {}, `Lesson ${n}: ${lesson.title}`);
    list.append(
      el('li', { class: `lesson-card lesson-card--${status.toLowerCase()}` },
        el('h2', { class: 'lesson-card__title' }, title),
        el('p', { class: 'lesson-card__meta' }, `${lesson.minutes} min · `, el('span', { class: 'status' }, status)),
        el('p', {}, lesson.summary),
      ),
    );
  }
  const testUnlocked = isTestUnlocked(progress);
  const testStatus = progress.testCompleted ? 'Done' : testUnlocked ? 'Ready' : 'Locked';
  list.append(
    el('li', { class: `lesson-card lesson-card--${testStatus.toLowerCase()}` },
      el('h2', { class: 'lesson-card__title' },
        testUnlocked ? el('a', { href: '#/final' }, 'Final test') : el('span', {}, 'Final test')),
      el('p', { class: 'lesson-card__meta' }, `${FINAL_TEST.minutes} min · `, el('span', { class: 'status' }, testStatus)),
      el('p', {}, 'Every outcome on a new tree, with no hints and no timer. Unlocks after Lesson 5.'),
    ),
  );

  const badges = el('ul', { class: 'badges' });
  if (progress.badges.length === 0) badges.append(el('li', { class: 'badges__empty' }, 'Pass a lesson to earn your first badge.'));
  for (const b of progress.badges) badges.append(el('li', { class: 'badge' }, badgeName(b)));

  root.append(
    el('h1', {}, 'Binary search trees, before the lecture'),
    el('p', { class: 'lead' }, 'Five short lessons and a final test, about 85 minutes in all. Stop whenever you like: your progress is saved in this browser.'),
    ctx.store.persistent ? '' : el('p', { class: 'notice', role: 'status' },
      'This browser is blocking saved data, so your progress lasts only until you close the tab. Use a progress code below to keep it.'),
    continueButton,
    list,
    el('section', { 'aria-labelledby': 'badges-heading' }, el('h2', { id: 'badges-heading' }, 'Your badges'), badges),
    transferSection(ctx),
  );
};

function transferSection(ctx: Parameters<Screen>[2]): HTMLElement {
  const output = el('textarea', { id: 'code-out', readonly: 'readonly', rows: '3', class: 'code' }) as HTMLTextAreaElement;
  const showButton = el('button', { type: 'button', class: 'button' }, 'Show my progress code');
  const copyButton = el('button', { type: 'button', class: 'button', hidden: 'hidden' }, 'Copy code');
  const input = el('textarea', { id: 'code-in', rows: '3', class: 'code' }) as HTMLTextAreaElement;
  const loadButton = el('button', { type: 'button', class: 'button' }, 'Load progress');
  const message = el('p', { role: 'status', class: 'transfer__message' });

  showButton.addEventListener('click', () => {
    output.value = ctx.store.exportCode();
    copyButton.hidden = false;
    output.focus();
    output.select();
  });
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(output.value);
      message.textContent = 'Copied. Paste it into the app on the other computer.';
    } catch {
      output.select();
      message.textContent = 'Select the code and copy it with Ctrl+C.';
    }
  });
  loadButton.addEventListener('click', () => {
    try {
      ctx.store.importCode(input.value);
      ctx.navigate({ name: 'overview' });
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'That code could not be loaded.';
    }
  });

  return el('details', { class: 'transfer' },
    el('summary', {}, 'Switching computers?'),
    el('p', {}, 'Copy your progress code here, then paste it into the app on the other computer. Loading a code replaces the progress in that browser.'),
    el('label', { for: 'code-out' }, 'Your progress code'), output,
    el('div', { class: 'actions' }, showButton, copyButton),
    el('label', { for: 'code-in' }, 'Paste a progress code'), input,
    el('div', { class: 'actions' }, loadButton),
    message,
  );
}
