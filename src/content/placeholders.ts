/**
  Filling placeholders in content text.
 
  - {50} means "key 50, shifted for this retake". Every key in content text
    must be written this way, or a retake would show the old number.
    Plain numbers ("3 comparisons", "Lesson 2") are left alone.
  - {name} is a value worked out by the resolver, such as {path} or
    {successor}. These are already in this retake's keys, so they are not
    shifted again. A list is joined with commas.
 
  Content text has no literal braces, so any '{' or '}' that isn't part of a
  placeholder is a typo and throws.
 */

export type PlaceholderValue = string | number | readonly number[];

// {65} or {successor}. */
const PLACEHOLDER = /\{(?:(\d+)|([A-Za-z][A-Za-z0-9_]*))\}/g;

function show(value: PlaceholderValue): string {
  return typeof value === 'object' ? value.join(', ') : String(value);
}

// Fill every placeholder in 'template'. Throws if a named placeholder has no value.
export function fillText(
  template: string,
  offset: number,
  values: Readonly<Record<string, PlaceholderValue>> = {},
): string {
  if (!Number.isInteger(offset)) {
    throw new RangeError(`A key offset must be a whole number, but got ${offset}`);
  }

  const filled = template.replace(PLACEHOLDER, (whole, key: string | undefined, name: string | undefined) => {
    if (key !== undefined) return String(Number(key) + offset);
    const value = Object.hasOwn(values, name as string) ? values[name as string] : undefined;
    if (value === undefined) {
      throw new Error(`The text "${template}" uses {${name}}, but no value was given for it`);
    }
    return show(value);
  });

  // Anything left with a brace was not a placeholder. Values never hold braces,
  // so check what's left of the template rather than the filled text.
  const leftover = template.replace(PLACEHOLDER, '');
  if (leftover.includes('{') || leftover.includes('}')) {
    throw new Error(`The text "${template}" has a brace that isn't a placeholder like {50} or {path}`);
  }

  return filled;
}