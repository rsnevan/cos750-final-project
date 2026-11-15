/**
  Demo mode for presenting the prototype. Open the app with ?demo in the
  address to turn it on. In demo mode:

  - every lesson and the final test can be opened straight away;
  - progress is kept in sessionStorage under its own key, so it never touches
    real saved progress and is gone when the tab closes;
  - the header shows a "Demo mode" label and a button that resets progress;
  - each question shows its answer, so the presenter can move quickly.
 */
import type { Part } from '../content';
import type { KeyValueStorage } from '../storage';

export const DEMO_STORAGE_KEY = 'cos212-bst-app-demo';

export function isDemo(search: string): boolean {
  return new URLSearchParams(search).has('demo');
}

export function demoStorage(): KeyValueStorage | null {
  try {
    return typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

// The answer to one question part, written out for the presenter.
export function answerText(part: Part): string {
  switch (part.type) {
    case 'pick':
      return part.options[part.answer] ?? '';
    case 'click':
      return Array.isArray(part.answer) ? part.answer.join(', ') : String(part.answer);
    case 'order':
      return part.answer.join(', ');
    case 'place':
      return part.keys
        .map((key, i) => {
          const slot = part.answer[i];
          if (slot === undefined) return String(key);
          return `${key} at ${slot.parent === null ? 'the root' : `the ${slot.side} of ${slot.parent}`}`;
        })
        .join('; ');
  }
}
