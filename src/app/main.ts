/**
  App shell: creates the progress store, follows the URL hash and draws one
  screen at a time. Locked lessons redirect to the overview.
 */
import './fonts.css';
import './app.css';
import { isLessonUnlocked, isTestUnlocked } from '../assessment';
import { createStore } from '../storage';
import type { AppContext, Route, Screen } from './context';
import { DEMO_STORAGE_KEY, demoStorage, isDemo } from './demo';
import { el } from './dom';
import { parseRoute, routeToHash } from './router';
import { overviewScreen } from './screens/overview';
import { lessonScreen } from './screens/lesson';
import { finalScreen } from './screens/final';

const root = document.getElementById('main');
if (root === null) throw new Error('index.html is missing <main id="main">');

const demo = isDemo(location.search);
const store = demo ? createStore(demoStorage(), DEMO_STORAGE_KEY) : createStore();
let cleanup: void | (() => void);

const ctx: AppContext = {
  store,
  demo,
  navigate(route) {
    const hash = routeToHash(route);
    if (location.hash === hash) render();
    else location.hash = hash;
  },
};

if (demo) {
  const reset = el('button', { type: 'button', class: 'demo-bar__reset' }, 'Reset demo');
  reset.addEventListener('click', () => {
    store.reset();
    ctx.navigate({ name: 'overview' });
  });
  document.querySelector('.app-header')?.append(
    el('span', { class: 'demo-bar' }, el('span', { class: 'demo-bar__label' }, 'Demo mode'), reset),
  );
}

function allowed(route: Route): boolean {
  if (demo) return true;
  const progress = store.load().progress;
  if (route.name === 'lesson') return isLessonUnlocked(progress, route.lesson);
  if (route.name === 'final') return isTestUnlocked(progress);
  return true;
}

function render(): void {
  const route = parseRoute(location.hash);
  if (!allowed(route)) {
    ctx.navigate({ name: 'overview' });
    return;
  }
  if (typeof cleanup === 'function') cleanup();
  root!.replaceChildren();
  window.scrollTo(0, 0);
  switch (route.name) {
    case 'lesson':
      cleanup = (lessonScreen as Screen<typeof route>)(root!, route, ctx);
      break;
    case 'final':
      cleanup = (finalScreen as Screen<typeof route>)(root!, route, ctx);
      break;
    default:
      cleanup = (overviewScreen as Screen<typeof route>)(root!, route, ctx);
  }
  // Move focus to the new screen's heading so screen readers announce it.
  const heading = root!.querySelector<HTMLElement>('h1');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

window.addEventListener('hashchange', render);
render();
