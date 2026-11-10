/**
  The content settings, loaded from `data/config.json` and checked on load,
  so a typo in the settings fails a test instead of reaching a student.
 */
import raw from './data/config.json';
import type { ContentConfig } from './schema';

const FIELDS = [
  'passThreshold',
  'middleBand',
  'hintRungs',
  'countCorrectAfterSolution',
  'lesson5NeedsEveryDeleteCase',
  'retakeOffsets',
  'keyRange',
] as const;

function fail(field: string, rule: string): never {
  throw new Error(`config.json: "${field}" ${rule}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isShare(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

// Check a settings object, throwing an Error naming the first problem found.
export function validateConfig(raw: unknown): ContentConfig {
  if (!isRecord(raw)) {
    throw new Error('config.json must hold one object of settings');
  }

  for (const field of FIELDS) {
    if (!(field in raw)) fail(field, 'is missing');
  }
  for (const field of Object.keys(raw)) {
    if (!(FIELDS as readonly string[]).includes(field)) {
      fail(field, `is not a setting (the settings are ${FIELDS.join(', ')})`);
    }
  }

  const {
    passThreshold,
    middleBand,
    hintRungs,
    countCorrectAfterSolution,
    lesson5NeedsEveryDeleteCase,
    retakeOffsets,
    keyRange,
  } = raw;

  if (!isShare(passThreshold) || passThreshold === 0) {
    fail('passThreshold', 'must be a share above 0 and at most 1, such as 0.8 for 80%');
  }
  if (!isShare(middleBand) || middleBand >= passThreshold) {
    fail('middleBand', 'must be a share from 0 up to, but not including, passThreshold');
  }
  if (!Number.isInteger(hintRungs) || (hintRungs as number) < 1 || (hintRungs as number) > 3) {
    fail('hintRungs', 'must be 1, 2 or 3 (nudge, highlight, worked solution)');
  }
  if (typeof countCorrectAfterSolution !== 'boolean') {
    fail('countCorrectAfterSolution', 'must be true or false');
  }
  if (typeof lesson5NeedsEveryDeleteCase !== 'boolean') {
    fail('lesson5NeedsEveryDeleteCase', 'must be true or false');
  }

  if (
    !Array.isArray(retakeOffsets) ||
    retakeOffsets.length === 0 ||
    !retakeOffsets.every(Number.isInteger) ||
    retakeOffsets[0] !== 0 ||
    new Set(retakeOffsets).size !== retakeOffsets.length
  ) {
    fail('retakeOffsets', 'must be whole numbers with no repeats, starting with 0 (the original keys)');
  }

  if (
    !Array.isArray(keyRange) ||
    keyRange.length !== 2 ||
    !keyRange.every(Number.isInteger) ||
    keyRange[0] < 1 ||
    keyRange[0] >= keyRange[1]
  ) {
    fail('keyRange', 'must be [smallest, largest]: two whole numbers from 1 up, smallest first');
  }

  return Object.freeze({
    passThreshold,
    middleBand,
    hintRungs: hintRungs as number,
    countCorrectAfterSolution,
    lesson5NeedsEveryDeleteCase,
    retakeOffsets: Object.freeze([...(retakeOffsets as number[])]) as number[],
    keyRange: Object.freeze([keyRange[0], keyRange[1]]) as unknown as [number, number],
  });
}

// The checked settings.
export const CONFIG: ContentConfig = validateConfig(raw);

// The key shift for a retake. Retakes past the last offset wrap round to the start.
export function offsetFor(retake: number, config: ContentConfig = CONFIG): number {
  if (!Number.isInteger(retake) || retake < 0) {
    throw new RangeError(`A retake number must be a whole number from 0 up, but got ${retake}`);
  }
  return config.retakeOffsets[retake % config.retakeOffsets.length] as number;
}