/**
  Small building blocks for checking the shape of JSON content. Each check
  takes a value and its path (such as `explore[2].key`), and returns a copy
  holding only the fields it knows, or throws a ShapeError naming the path.
  Internal to the content module.
 */

export class ShapeError extends Error {}

export type Check = (value: unknown, path: string) => unknown;

export function bad(path: string, rule: string): never {
  throw new ShapeError(path === '' ? rule : `${path} ${rule}`);
}

function at(path: string, field: string): string {
  return path === '' ? field : `${path}.${field}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

//  single values 

// Text that isn't empty. Placeholders like `{50}` are checked when the text is filled.
export const text: Check = (value, path) => {
  if (typeof value !== 'string' || value.trim() === '') bad(path, 'must be text');
  return value;
};

// Stage text: shown with the original keys only, so it has no placeholders. 
export const plainText: Check = (value, path) => {
  text(value, path);
  if (/[{}]/.test(value as string)) {
    bad(path, 'must not contain braces: stage text never changes keys, so write 60, not {60}');
  }
  return value;
};

export const int: Check = (value, path) => {
  if (!Number.isInteger(value)) bad(path, 'must be a whole number');
  return value;
};

export const positiveInt: Check = (value, path) => {
  if (!Number.isInteger(value) || (value as number) < 1) bad(path, 'must be a whole number from 1 up');
  return value;
};

export const bool: Check = (value, path) => {
  if (typeof value !== 'boolean') bad(path, 'must be true or false');
  return value;
};

// One of a fixed set of values. 
export function literal(...allowed: (string | number)[]): Check {
  return (value, path) => {
    if (!allowed.includes(value as string | number)) {
      bad(path, `must be one of ${allowed.map((a) => JSON.stringify(a)).join(', ')}`);
    }
    return value;
  };
}

//  combinations 

export function list(check: Check, { min = 0, max = Infinity } = {}): Check {
  return (value, path) => {
    if (!Array.isArray(value)) bad(path, 'must be a list');
    if (value.length < min) bad(path, `must have at least ${min} ${min === 1 ? 'entry' : 'entries'}`);
    if (value.length > max) bad(path, `must have at most ${max} entries`);
    return value.map((entry, i) => check(entry, `${path}[${i}]`));
  };
}

export const intList = (options: { min?: number; max?: number } = {}) => list(int, options);

export function tuple(...checks: Check[]): Check {
  return (value, path) => {
    if (!Array.isArray(value) || value.length !== checks.length) bad(path, `must be a list of ${checks.length}`);
    return checks.map((check, i) => check(value[i], `${path}[${i}]`));
  };
}

// An object whose keys are whole numbers (as JSON writes them, "55") and whose values pass `check`. 
export function keyedByNode(check: Check): Check {
  return (value, path) => {
    if (!isRecord(value)) bad(path, 'must be an object keyed by node keys');
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (!/^-?\d+$/.test(key)) bad(at(path, key), 'is not a whole-number key');
      out[key] = check(entry, at(path, key));
    }
    return out;
  };
}

// An object with these required and optional fields, and no others. 
export function object(required: Record<string, Check>, optional: Record<string, Check> = {}): Check {
  const known = [...Object.keys(required), ...Object.keys(optional)];
  return (value, path) => {
    if (!isRecord(value)) bad(path, 'must be an object');
    for (const field of Object.keys(value)) {
      if (!known.includes(field)) bad(at(path, field), `is not a field here (the fields are ${known.join(', ')})`);
    }
    const out: Record<string, unknown> = {};
    for (const [field, check] of Object.entries(required)) {
      if (!(field in value)) bad(at(path, field), 'is missing');
      out[field] = check(value[field], at(path, field));
    }
    for (const [field, check] of Object.entries(optional)) {
      if (field in value && value[field] !== undefined) out[field] = check(value[field], at(path, field));
    }
    return out;
  };
}

// An object chosen by a field such as `kind`, each kind with its own fields. 
export function kinded(field: string, kinds: Record<string, Check>): Check {
  return (value, path) => {
    if (!isRecord(value)) bad(path, 'must be an object');
    const kind = value[field];
    const check = typeof kind === 'string' && Object.hasOwn(kinds, kind) ? kinds[kind] : undefined;
    if (check === undefined) {
      bad(at(path, field), `must be one of ${Object.keys(kinds).map((k) => JSON.stringify(k)).join(', ')}`);
    }
    const { [field]: _, ...rest } = value;
    return { [field]: kind, ...(check(rest, path) as object) };
  };
}

// `null`, or a value passing `check`. 
export function nullable(check: Check): Check {
  return (value, path) => (value === null ? null : check(value, path));
}

// Check a value, then a rule about it as a whole, such as "the answer is one of the options". 
export function refine(check: Check, rule: (value: any, path: string) => void): Check {
  return (value, path) => {
    const out = check(value, path);
    rule(out, path);
    return out;
  };
}

// A multiple-choice answer: `answer` must index `options`. 
export function answerInRange(value: { options: unknown[]; answer: number | null }, path: string): void {
  if (value.answer !== null && (value.answer < 0 || value.answer >= value.options.length)) {
    bad(at(path, 'answer'), `must be one of the ${value.options.length} options, counting from 0`);
  }
}

// A tree drawn exactly: `[key]`, `[key, left]` or `[key, left, right]`, children `null` or the same. 
export const shape: Check = (value, path) => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    bad(path, 'must be [key], [key, left] or [key, left, right]');
  }
  return value.map((part, i) => (i === 0 ? int(part, `${path}[0]`) : nullable(shape)(part, `${path}[${i}]`)));
};

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}