/**
  Highlights for hints and the `base` of a question: presets worked out from
  the item's task, or highlights written in the JSON with retake-0 keys.
  Internal to the content module.
 */
import { leaves, maxPath, minPath, preorder, search, subtree } from '../engine';
import type { Highlight } from '../engine';
import type { HighlightPreset } from './schema';
import {
  fail,
  fill,
  longestPath,
  outside,
  pathEdges,
  pathTo,
  shiftKey,
  shiftNode,
  type Context,
  type Values,
} from './context';

// Work out a preset highlight from the item's tree and task.
export function presetHighlight(context: Context, preset: HighlightPreset, where: string): Highlight {
  const { tree } = context;
  const need = <T>(value: T | undefined, what: string): T => {
    if (value === undefined) fail(context, `${where}: the "${preset}" highlight needs a task with ${what}`);
    return value;
  };

  switch (preset) {
    case 'path': {
      const path = search(tree, need(context.key, 'a key')).path;
      return { visited: path, edges: pathEdges(path) };
    }

    case 'otherHalf': {
      const key = need(context.key, 'a key');
      if (tree === null || key === tree.key) {
        fail(context, `${where}: the "otherHalf" highlight needs a key other than the root's`);
      }
      const half = key < tree.key ? tree.right : tree.left;
      if (half === null) fail(context, `${where}: the "otherHalf" highlight has nothing to dim`);
      return { dimmed: preorder(half) };
    }

    case 'emptySpot': {
      const result = search(tree, need(context.key, 'a key'));
      if (result.found) fail(context, `${where}: the "emptySpot" highlight needs a key that is not in the tree`);
      return { slot: { parent: result.endAt, side: result.side } };
    }

    case 'longestPath':
      return { edges: pathEdges(longestPath(tree)) };

    case 'leaves':
      return { outlined: leaves(tree) };

    case 'depthHeight': {
      if (context.depthOf === undefined && context.heightOf === undefined) {
        fail(context, `${where}: the "depthHeight" highlight needs a depthHeight task`);
      }
      const highlight: { edges?: [number, number][]; outlined?: number[] } = {};
      if (context.depthOf !== undefined) highlight.edges = pathEdges(pathTo(tree, context.depthOf) ?? []);
      if (context.heightOf !== undefined) highlight.outlined = preorder(subtree(tree, context.heightOf));
      return highlight;
    }

    case 'extremePaths': {
      const find = need(context.find, 'a minimum or maximum to find');
      const start = context.from === undefined ? tree : subtree(tree, context.from);
      return { edges: find.flatMap((which) => pathEdges(which === 'min' ? minPath(start) : maxPath(start))) };
    }

    case 'outsideSubtree': {
      const root = need(context.from ?? context.key, 'a subtree (from) or a key');
      const dimmed = outside(tree, root);
      if (dimmed.length === 0) fail(context, `${where}: the "outsideSubtree" highlight has nothing to dim`);
      return { dimmed };
    }

    case 'dots':
      return { dots: need(context.order, 'a traversal order') };

    case 'children': {
      const node = subtree(tree, need(context.key, 'a key'));
      const children = [node?.left?.key, node?.right?.key].filter((key) => key !== undefined);
      return children.length === 0 ? {} : { outlined: children };
    }

    case 'rightSubtree': {
      const key = need(context.key, 'a key');
      const right = subtree(tree, key)?.right ?? null;
      if (right === null) fail(context, `${where}: the "rightSubtree" highlight needs a key with a right subtree`);
      const dimmed = outside(tree, key);
      return dimmed.length === 0 ? { outlined: preorder(right) } : { outlined: preorder(right), dimmed };
    }

    default:
      return fail(context, `${where}: there is no highlight preset "${preset as string}"`);
  }
}

// Check that `child` is directly below `parent`.
function checkEdge(context: Context, parent: number, child: number, where: string): void {
  const node = subtree(context.tree, parent);
  if (node?.left?.key !== child && node?.right?.key !== child) {
    fail(context, `${where}: ${child - context.offset} is not a child of ${parent - context.offset}`);
  }
}

/**
  Shift every key in a written highlight, checking each one names a node in
  the tree, and fill keys written in its labels (`tags`, `slotLabel`, `edgeLabels`).
 */
export function writtenHighlight(context: Context, values: Values, written: Highlight, where: string): Highlight {
  const node = (key: number) => shiftNode(context, key, where);
  const nodes = (keys: readonly number[]) => keys.map(node);
  const text = (label: string) => fill(context, values, label, where);
  const edge = (parent: number, child: number): [number, number] => {
    const pair: [number, number] = [node(parent), node(child)];
    checkEdge(context, pair[0], pair[1], where);
    return pair;
  };
  const out: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(written)) {
    switch (field) {
      case 'visited':
      case 'outlined':
      case 'dimmed':
      case 'output':
        out[field] = nodes(value as number[]);
        break;
      case 'current':
      case 'found':
      case 'offender':
      case 'ghost':
        out[field] = node(value as number);
        break;
      case 'edges':
        out[field] = (value as [number, number][]).map(([parent, child]) => edge(parent, child));
        break;
      case 'edgeLabels':
        out[field] = (value as [number, number, string][]).map(([parent, child, label]) => [
          ...edge(parent, child),
          text(label),
        ]);
        break;
      case 'tags':
        out[field] = Object.fromEntries(
          Object.entries(value as Record<string, string>).map(([key, tag]) => [node(Number(key)), text(tag)]),
        );
        break;
      case 'relabel':
        // The new label is a key being copied in, so it need not be a node of its own.
        out[field] = Object.fromEntries(
          Object.entries(value as Record<string, number>).map(([from, to]) => [
            node(Number(from)),
            shiftKey(context, to, where),
          ]),
        );
        break;
      case 'marker': {
        const marker = value as { key: number; position: string };
        out[field] = { key: node(marker.key), position: marker.position };
        break;
      }
      case 'slot': {
        const slot = value as { parent: number; side: 'left' | 'right' };
        const parent = node(slot.parent);
        if (subtree(context.tree, parent)?.[slot.side] !== null) {
          fail(context, `${where}: the ${slot.side} side of ${slot.parent} is not an empty spot`);
        }
        out[field] = { parent, side: slot.side };
        break;
      }
      case 'slotLabel':
        out[field] = text(value as string);
        break;
      case 'dots':
        out[field] = value;
        break;
      default:
        fail(context, `${where}: a highlight has no field "${field}"`);
    }
  }
  return out as Highlight;
}

// A preset name or a written highlight, worked out for this retake. 
export function anyHighlight(
  context: Context,
  values: Values,
  spec: HighlightPreset | Highlight,
  where: string,
): Highlight {
  return typeof spec === 'string'
    ? presetHighlight(context, spec, where)
    : writtenHighlight(context, values, spec, where);
}