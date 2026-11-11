/**
  Saving progress, settings and earlier attempts (ID document 10.3).

  The prototype keeps everything in the browser's localStorage, so it works
  on GitHub Pages and in the offline demo build with no server. To move to
  another computer, a student copies a progress code from one browser and
  pastes it into the other (exportCode / importCode). Accounts with sign-in
  are future work: only this module would change, because screens only
  ever call the store's methods.

  What is saved is only what the lessons need: lessons passed, badges,
  whether the final test is done, display settings, and a short history of
  attempts. No names, emails or student numbers (POPIA: minimum data).

  If storage is blocked (private browsing, disabled cookies), the store
  falls back to memory, so the app still works for one sitting.
 */
import { LESSON_NUMBERS, newProgress } from '../assessment';
import type { Badge, Band, LessonNumber, Progress } from '../assessment';
import type { VisualiserSettings } from '../visualiser';

export const STORAGE_KEY = 'cos212-bst-app';
export const SCHEMA_VERSION = 1;
export const MAX_ATTEMPTS = 100;

export type AttemptLesson = LessonNumber | 'final';

export interface AttemptRecord {
  readonly lesson: AttemptLesson;
  // Activity band for a lesson; null for the final test, which shows no mark.
  readonly band: Band | null;
  // Ids of the items missed, so a retry can repeat only those.
  readonly missed: readonly string[];
  // ISO date and time.
  readonly at: string;
}

export interface SavedState {
  readonly version: typeof SCHEMA_VERSION;
  readonly progress: Progress;
  readonly settings: Partial<VisualiserSettings>;
  readonly attempts: readonly AttemptRecord[];
}

// The part of the Web Storage API the store uses, so tests can pass a fake.
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ProgressStore {
  load(): SavedState;
  saveProgress(progress: Progress): SavedState;
  saveSettings(settings: Partial<VisualiserSettings>): SavedState;
  recordAttempt(attempt: Omit<AttemptRecord, 'at'> & { at?: string }): SavedState;
  attemptsFor(lesson: AttemptLesson): readonly AttemptRecord[];
  // A short code a student can copy to move their progress to another computer.
  exportCode(): string;
  // Replaces the saved state. Throws a readable Error if the code is not valid.
  importCode(code: string): SavedState;
  reset(): SavedState;
  // False when the browser blocked storage and progress lasts only this sitting.
  readonly persistent: boolean;
}

const CODE_PREFIX = 'BST1-';
const BANDS: readonly Band[] = ['pass', 'mid', 'low'];
const BADGES: readonly Badge[] = ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4', 'lesson-5', 'bst-ready'];
const TEXT_SIZES: readonly VisualiserSettings['textSize'][] = ['small', 'medium', 'large'];
const BOOLEAN_SETTINGS = ['highContrast', 'readableFont', 'reducedMotion', 'narration'] as const;

export function emptyState(): SavedState {
  return { version: SCHEMA_VERSION, progress: newProgress(), settings: {}, attempts: [] };
}

export function createStore(storage: KeyValueStorage | null = browserStorage(), key = STORAGE_KEY): ProgressStore {
  const persistent = storage !== null && canWrite(storage, key);
  const backing: KeyValueStorage = persistent && storage !== null ? storage : memoryStorage();
  let state = readState(backing, key);

  function write(next: SavedState): SavedState {
    state = next;
    try {
      backing.setItem(key, JSON.stringify(next));
    } catch {
      // Quota or a storage error: keep the state in memory for this sitting.
    }
    return state;
  }

  return {
    persistent,
    load: () => state,
    saveProgress: (progress) => write({ ...state, progress: sanitiseProgress(progress) }),
    saveSettings: (settings) => write({ ...state, settings: sanitiseSettings({ ...state.settings, ...settings }) }),
    recordAttempt(attempt) {
      const record = sanitiseAttempt({ ...attempt, at: attempt.at ?? new Date().toISOString() });
      if (record === null) throw new Error('Not a valid attempt record');
      return write({ ...state, attempts: [...state.attempts, record].slice(-MAX_ATTEMPTS) });
    },
    attemptsFor: (lesson) => state.attempts.filter((a) => a.lesson === lesson),
    exportCode: () => CODE_PREFIX + toBase64(JSON.stringify(state)),
    importCode(code) {
      const trimmed = code.trim();
      if (!trimmed.startsWith(CODE_PREFIX)) throw new Error('That is not a progress code from this app.');
      let parsed: unknown;
      try {
        parsed = JSON.parse(fromBase64(trimmed.slice(CODE_PREFIX.length)));
      } catch {
        throw new Error('That progress code is incomplete. Copy the whole code and try again.');
      }
      const next = sanitiseState(parsed);
      if (next === null) throw new Error('That progress code could not be read.');
      return write(next);
    },
    reset: () => write(emptyState()),
  };
}

// ----- Reading and checking saved data -----

function readState(storage: KeyValueStorage, key: string): SavedState {
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return emptyState();
  }
  if (raw === null) return emptyState();
  try {
    return sanitiseState(JSON.parse(raw)) ?? emptyState();
  } catch {
    return emptyState();
  }
}

// Returns a clean state, or null if the data is not a saved state at all.
// Unknown or damaged fields are dropped rather than trusted.
export function sanitiseState(value: unknown): SavedState | null {
  if (!isRecord(value) || value.version !== SCHEMA_VERSION) return null;
  const attempts = Array.isArray(value.attempts)
    ? value.attempts.map(sanitiseAttempt).filter((a): a is AttemptRecord => a !== null).slice(-MAX_ATTEMPTS)
    : [];
  return {
    version: SCHEMA_VERSION,
    progress: sanitiseProgress(value.progress),
    settings: sanitiseSettings(value.settings),
    attempts,
  };
}

function sanitiseProgress(value: unknown): Progress {
  if (!isRecord(value)) return newProgress();
  const passedRaw = Array.isArray(value.passed) ? value.passed : [];
  const passedSet = new Set(passedRaw.filter((n): n is LessonNumber => LESSON_NUMBERS.includes(n as LessonNumber)));
  // Lessons unlock in order, so keep only an unbroken run from Lesson 1.
  const passed: LessonNumber[] = [];
  for (const n of LESSON_NUMBERS) {
    if (!passedSet.has(n)) break;
    passed.push(n);
  }
  const testCompleted = value.testCompleted === true && passed.includes(5);
  const allowed = new Set<Badge>([...passed.map((n) => `lesson-${n}` as Badge), ...(testCompleted ? ['bst-ready' as Badge] : [])]);
  const badgesRaw = Array.isArray(value.badges) ? value.badges : [];
  const badges = [...new Set(badgesRaw.filter((b): b is Badge => BADGES.includes(b as Badge) && allowed.has(b as Badge)))];
  // A passed lesson always has its badge, even if the saved list lost it.
  for (const b of allowed) if (!badges.includes(b)) badges.push(b);
  return { passed, badges, testCompleted };
}

function sanitiseSettings(value: unknown): Partial<VisualiserSettings> {
  if (!isRecord(value)) return {};
  const out: { -readonly [K in keyof VisualiserSettings]?: VisualiserSettings[K] } = {};
  for (const name of BOOLEAN_SETTINGS) {
    if (typeof value[name] === 'boolean') out[name] = value[name] as boolean;
  }
  if (TEXT_SIZES.includes(value.textSize as VisualiserSettings['textSize'])) {
    out.textSize = value.textSize as VisualiserSettings['textSize'];
  }
  return out;
}

function sanitiseAttempt(value: unknown): AttemptRecord | null {
  if (!isRecord(value)) return null;
  const lesson = value.lesson;
  const validLesson = lesson === 'final' || LESSON_NUMBERS.includes(lesson as LessonNumber);
  const band = value.band === null || value.band === undefined ? null : value.band;
  if (!validLesson || (band !== null && !BANDS.includes(band as Band))) return null;
  if (typeof value.at !== 'string' || Number.isNaN(Date.parse(value.at))) return null;
  const missed = Array.isArray(value.missed) ? value.missed.filter((m): m is string => typeof m === 'string') : [];
  return { lesson: lesson as AttemptLesson, band: band as Band | null, missed, at: value.at };
}

// ----- Storage helpers -----

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null; // Some browsers throw on access when storage is blocked.
  }
}

function canWrite(storage: KeyValueStorage, key: string): boolean {
  const probe = `${key}:probe`;
  try {
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Saved data is plain ASCII JSON, but encode as UTF-8 anyway to be safe.
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(code: string): string {
  const binary = atob(code.replace(/\s+/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}
