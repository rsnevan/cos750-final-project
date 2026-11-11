/**
  Hash routes (#/, #/lesson/3, #/final). Hash routing needs no server
  rewrites, so it works on GitHub Pages and when index.html is opened
  from disk in the offline build.
 */
import type { Route } from './context';

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split(/[?#]/)[0] ?? '';
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'lesson') {
    const n = Number(parts[1]);
    if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return { name: 'lesson', lesson: n };
  }
  if (parts[0] === 'final' && parts.length === 1) return { name: 'final' };
  return { name: 'overview' };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'lesson':
      return `#/lesson/${route.lesson}`;
    case 'final':
      return '#/final';
    default:
      return '#/';
  }
}
