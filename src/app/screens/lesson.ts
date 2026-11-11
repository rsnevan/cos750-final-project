/**
  Lesson screen.

  PLACEHOLDER until the six stage screens from the lessons-and-assessment
  work are merged. It shows the lesson's details and a working visualiser
  player for the lesson's main operation, so the build, routing, settings
  and progress saving can be tested end to end now.

  To plug in the real screens: replace the body of `lessonScreen`, keep the
  signature, and call `finishActivity(ctx, lesson, result)` when the
  end-of-lesson activity is scored. Visualiser settings are saved through
  `ctx.store.saveSettings`, as below.
 */
import { CONFIG } from '../../content';
import { getLesson, getTree } from '../../content';
import { PSEUDOCODE, buildSteps, deleteSteps, insertSteps, searchSteps, traversalSteps } from '../../engine';
import type { Step } from '../../engine';
import type { ActivityResult, Band, LessonNumber } from '../../assessment';
import { createPlayer } from '../../visualiser';
import type { Route, Screen } from '../context';
import { el } from '../dom';
import { finishActivity } from '../progressActions';

const STAGES = ['Hook and recall', 'Explore', 'Explain', 'Worked example', 'Try it', 'End-of-lesson activity'];

// One demonstration per lesson, on the reference tree T from the lesson plans.
function demo(lesson: LessonNumber): { label: string; steps: Step[]; pseudocode?: readonly string[] } {
  const T = getTree('T');
  switch (lesson) {
    case 1: return { label: 'Building tree T by inserting 50, 30, 70, 20, 40, 60, 80', steps: buildSteps([50, 30, 70, 20, 40, 60, 80]) };
    case 2: return { label: 'Searching tree T for 40', steps: searchSteps(T, 40), pseudocode: PSEUDOCODE.search };
    case 3: return { label: 'Inserting 45 into tree T', steps: insertSteps(T, 45), pseudocode: PSEUDOCODE.insert };
    case 4: return { label: 'In-order traversal of tree T', steps: traversalSteps(T, 'in'), pseudocode: PSEUDOCODE.traverse };
    case 5: return { label: 'Deleting 50 (two children) from tree T', steps: deleteSteps(T, 50), pseudocode: PSEUDOCODE.delete };
  }
}

export const lessonScreen: Screen<Extract<Route, { name: 'lesson' }>> = (root, route, ctx) => {
  const n = route.lesson;
  const lesson = getLesson(n);
  const { label, steps, pseudocode } = demo(n);

  const playerMount = el('div', { class: 'player' });
  const back = el('button', { type: 'button', class: 'button' }, 'Back to all lessons');
  back.addEventListener('click', () => ctx.navigate({ name: 'overview' }));

  root.append(
    el('p', { class: 'eyebrow' }, `Lesson ${n} of 5 · ${lesson.minutes} min`),
    el('h1', {}, lesson.title),
    el('p', { class: 'lead' }, lesson.summary),
    el('ol', { class: 'stages', 'aria-label': 'Lesson stages' }, ...STAGES.map((s) => el('li', {}, s))),
    el('section', { 'aria-labelledby': 'demo-heading' }, el('h2', { id: 'demo-heading' }, label), playerMount),
    devControls(ctx, n),
    el('div', { class: 'actions' }, back),
  );

  const player = createPlayer(playerMount, steps, {
    pseudocode,
    settings: ctx.store.load().settings,
    onSettingsChange: (settings) => ctx.store.saveSettings(settings),
  });
  return () => player.destroy();
};

// Lets the team test unlocking and saving before the activity screens exist.
// Remove once the real end-of-lesson activity calls finishActivity.
function devControls(ctx: Parameters<Screen>[2], lesson: LessonNumber): HTMLElement {
  const select = el('select', { id: 'dev-band' },
    el('option', { value: 'pass' }, `Pass (${Math.round(CONFIG.passThreshold * 100)}% or more)`),
    el('option', { value: 'mid' }, 'Middle band'),
    el('option', { value: 'low' }, 'Low band'),
  ) as HTMLSelectElement;
  const record = el('button', { type: 'button', class: 'button' }, 'Record result');
  const message = el('p', { role: 'status' });
  record.addEventListener('click', () => {
    const result: ActivityResult = { band: select.value as Band, caseRuleMet: null, missed: [] };
    const changed = finishActivity(ctx, lesson, result);
    message.textContent = changed ? `Lesson ${lesson} passed. The next step is unlocked.` : 'Result recorded. Nothing new unlocked.';
  });
  return el('details', { class: 'dev' },
    el('summary', {}, 'Developer controls (temporary)'),
    el('label', { for: 'dev-band' }, 'Activity result '), select, ' ', record, message,
  );
}
