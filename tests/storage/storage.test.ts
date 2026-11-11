import { describe, expect, it } from 'vitest';
import { applyActivity, completeTest, newProgress } from '../../src/assessment';
import type { ActivityResult, Progress } from '../../src/assessment';
import {
  MAX_ATTEMPTS,
  STORAGE_KEY,
  createStore,
  emptyState,
  memoryStorage,
  sanitiseState,
  type KeyValueStorage,
} from '../../src/storage';

const PASS: ActivityResult = { band: 'pass', caseRuleMet: null, missed: [] };

function passLessons(count: number): Progress {
  let p = newProgress();
  for (let n = 1; n <= count; n++) p = applyActivity(p, n as 1 | 2 | 3 | 4 | 5, PASS);
  return p;
}

function blockedStorage(): KeyValueStorage {
  return {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
}

describe('createStore', () => {
  it('starts empty when nothing is saved', () => {
    const store = createStore(memoryStorage());
    expect(store.load()).toEqual(emptyState());
    expect(store.persistent).toBe(true);
  });

  it('keeps progress between page loads', () => {
    const storage = memoryStorage();
    createStore(storage).saveProgress(passLessons(2));
    const reloaded = createStore(storage).load();
    expect(reloaded.progress.passed).toEqual([1, 2]);
    expect(reloaded.progress.badges).toEqual(['lesson-1', 'lesson-2']);
  });

  it('merges settings and keeps them between loads', () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    store.saveSettings({ highContrast: true });
    store.saveSettings({ textSize: 'large' });
    expect(createStore(storage).load().settings).toEqual({ highContrast: true, textSize: 'large' });
  });

  it('records attempts and filters them by lesson', () => {
    const store = createStore(memoryStorage());
    store.recordAttempt({ lesson: 2, band: 'mid', missed: ['a3'], at: '2026-11-12T08:00:00.000Z' });
    store.recordAttempt({ lesson: 2, band: 'pass', missed: [] });
    store.recordAttempt({ lesson: 'final', band: null, missed: ['q4'] });
    expect(store.attemptsFor(2).map((a) => a.band)).toEqual(['mid', 'pass']);
    expect(store.attemptsFor('final')).toHaveLength(1);
  });

  it('keeps only the most recent attempts', () => {
    const store = createStore(memoryStorage());
    for (let i = 0; i < MAX_ATTEMPTS + 5; i++) store.recordAttempt({ lesson: 1, band: 'low', missed: [String(i)] });
    const attempts = store.load().attempts;
    expect(attempts).toHaveLength(MAX_ATTEMPTS);
    expect(attempts[0]?.missed).toEqual(['5']);
  });

  it('rejects an invalid attempt', () => {
    const store = createStore(memoryStorage());
    // @ts-expect-error: lesson 9 does not exist
    expect(() => store.recordAttempt({ lesson: 9, band: 'pass', missed: [] })).toThrow();
  });

  it('falls back to memory when storage is blocked', () => {
    const store = createStore(blockedStorage());
    expect(store.persistent).toBe(false);
    store.saveProgress(passLessons(1));
    expect(store.load().progress.passed).toEqual([1]);
  });

  it('falls back to memory when there is no storage at all', () => {
    const store = createStore(null);
    expect(store.persistent).toBe(false);
    expect(store.load()).toEqual(emptyState());
  });

  it('starts fresh when the saved data is damaged', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    expect(createStore(storage).load()).toEqual(emptyState());
  });

  it('starts fresh when the saved data is from an unknown version', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, progress: { passed: [1] } }));
    expect(createStore(storage).load()).toEqual(emptyState());
  });

  it('reset clears everything', () => {
    const storage = memoryStorage();
    const store = createStore(storage);
    store.saveProgress(passLessons(3));
    store.reset();
    expect(createStore(storage).load()).toEqual(emptyState());
  });
});

describe('progress codes', () => {
  it('moves progress, settings and attempts to another browser', () => {
    const from = createStore(memoryStorage());
    from.saveProgress(completeTest(passLessons(5)));
    from.saveSettings({ reducedMotion: true });
    from.recordAttempt({ lesson: 5, band: 'pass', missed: [] });

    const to = createStore(memoryStorage());
    to.importCode(from.exportCode());
    expect(to.load()).toEqual(from.load());
  });

  it('accepts a code with spaces or line breaks around it', () => {
    const from = createStore(memoryStorage());
    from.saveProgress(passLessons(1));
    const to = createStore(memoryStorage());
    to.importCode(`  ${from.exportCode()}\n`);
    expect(to.load().progress.passed).toEqual([1]);
  });

  it('rejects text that is not a progress code', () => {
    const store = createStore(memoryStorage());
    expect(() => store.importCode('hello')).toThrow(/not a progress code/);
  });

  it('rejects a cut-off code and keeps the current progress', () => {
    const from = createStore(memoryStorage());
    from.saveProgress(passLessons(2));
    const to = createStore(memoryStorage());
    to.saveProgress(passLessons(1));
    expect(() => to.importCode(from.exportCode().slice(0, 20))).toThrow();
    expect(to.load().progress.passed).toEqual([1]);
  });
});

describe('sanitiseState', () => {
  it('rejects anything that is not a saved state', () => {
    expect(sanitiseState(null)).toBeNull();
    expect(sanitiseState([1, 2])).toBeNull();
    expect(sanitiseState({ progress: {} })).toBeNull();
  });

  it('keeps only lessons passed in order from Lesson 1', () => {
    const state = sanitiseState({ version: 1, progress: { passed: [1, 2, 4, 7], badges: [], testCompleted: false } });
    expect(state?.progress.passed).toEqual([1, 2]);
  });

  it('drops badges that were not earned and adds badges that were', () => {
    const state = sanitiseState({
      version: 1,
      progress: { passed: [1], badges: ['lesson-3', 'bst-ready', 'gold-star'], testCompleted: true },
    });
    expect(state?.progress).toEqual({ passed: [1], badges: ['lesson-1'], testCompleted: false });
  });

  it('drops unknown or badly typed settings', () => {
    const state = sanitiseState({ version: 1, settings: { highContrast: 'yes', textSize: 'huge', narration: true, theme: 'dark' } });
    expect(state?.settings).toEqual({ narration: true });
  });

  it('drops damaged attempt records', () => {
    const state = sanitiseState({
      version: 1,
      attempts: [
        { lesson: 1, band: 'pass', missed: [], at: '2026-11-12T08:00:00Z' },
        { lesson: 1, band: 'excellent', missed: [], at: '2026-11-12T08:00:00Z' },
        { lesson: 'final', band: null, missed: ['x', 3], at: 'not a date' },
      ],
    });
    expect(state?.attempts).toHaveLength(1);
  });
});
