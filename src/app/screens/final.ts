/**
  Final test screen.

  PLACEHOLDER until the final test screens are merged. Call
  `finishFinalTest(ctx, missed)` after the last item.
 */
import { FINAL_TEST } from '../../content';
import { drawTree } from '../../visualiser';
import { getTree } from '../../content';
import type { Screen } from '../context';
import { el } from '../dom';
import { finishFinalTest } from '../progressActions';

export const finalScreen: Screen = (root, _route, ctx) => {
  const treeMount = el('div', { class: 'player' });
  const back = el('button', { type: 'button', class: 'button' }, 'Back to all lessons');
  back.addEventListener('click', () => ctx.navigate({ name: 'overview' }));
  const finish = el('button', { type: 'button', class: 'button' }, 'Mark test finished');
  finish.addEventListener('click', () => {
    finishFinalTest(ctx, []);
    ctx.navigate({ name: 'overview' });
  });

  root.append(
    el('p', { class: 'eyebrow' }, `Final test · ${FINAL_TEST.minutes} min · no hints, no timer`),
    el('h1', {}, 'Final test'),
    el('p', { class: 'lead' }, 'Every outcome from the five lessons, on tree U, which you have not seen before.'),
    treeMount,
    el('details', { class: 'dev' }, el('summary', {}, 'Developer controls (temporary)'), finish),
    el('div', { class: 'actions' }, back),
  );
  drawTree(treeMount, getTree('U'));
};
