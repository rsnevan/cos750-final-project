// Answer parts written in an item. Internal to the content module.
 
import type { Part, PartSpec } from './schema';
import { fail, fill, shiftNode, shuffledOrder, type Context, type Values } from './context';

// A pick part of whole numbers 0 up to at least 3, and one past the answer, so the answer is never last.
export function numberPick(label: string, answer: number): Part {
  const top = Math.max(3, answer + 1);
  const options = Array.from({ length: top + 1 }, (_, i) => String(i));
  return { type: 'pick', label, options, answer };
}

function clickAnswer(context: Context, values: Values, spec: Extract<PartSpec, { type: 'click' }>, where: string) {
  const { answer, mode } = spec;

  if (typeof answer === 'string') {
    const value = Object.hasOwn(values, answer) ? values[answer] : undefined;
    if (value === undefined) fail(context, `${where}: this task works out no value called "${answer}"`);
    if (mode === 'one' && typeof value !== 'number') {
      fail(context, `${where}: "${answer}" is not a single key, so it can't answer a click-one part`);
    }
    if (mode !== 'one' && !Array.isArray(value)) {
      fail(context, `${where}: "${answer}" is not a list of keys, so it can't answer a click-${mode} part`);
    }
    return Array.isArray(value) ? [...value] : value;
  }

  if (mode === 'one') {
    if (typeof answer !== 'number') fail(context, `${where}: a click-one answer is one key`);
    return shiftNode(context, answer, where);
  }
  if (!Array.isArray(answer)) fail(context, `${where}: a click-${mode} answer is a list of keys`);
  return answer.map((key) => shiftNode(context, key, where));
}

// Build a written part. `index` is its position in the question, used to seed its shuffle. 
export function buildPart(context: Context, values: Values, spec: PartSpec, index: number): Part {
  const where = `part ${index + 1}`;
  const label = fill(context, values, spec.label ?? '', `${where} label`);

  if (spec.type === 'pick') {
    const options = spec.options.map((option, i) => fill(context, values, option, `${where} option ${i + 1}`));
    if (options.length < 2) fail(context, `${where}: a pick part needs at least two options`);
    if (new Set(options).size !== options.length) {
      fail(context, `${where}: two options read the same on retake ${context.retake}`);
    }
    if (!Number.isInteger(spec.answer) || spec.answer < 0 || spec.answer >= options.length) {
      fail(context, `${where}: answer ${spec.answer} is not one of its ${options.length} options (they count from 0)`);
    }
    if (!spec.shuffle) return { type: 'pick', label, options, answer: spec.answer };
    const order = shuffledOrder(context, index, options.length);
    return {
      type: 'pick',
      label,
      options: order.map((i) => options[i] as string),
      answer: order.indexOf(spec.answer),
    };
  }

  if (spec.type === 'click') {
    const answer = clickAnswer(context, values, spec, where);
    return { type: 'click', label, mode: spec.mode, answer } as Part;
  }

  return fail(context, `${where}: there is no part type "${(spec as { type: unknown }).type}"`);
}