import type { Tree } from '../engine';

export interface NodePosition {
  readonly id: string;
  readonly key: number;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

export interface TreeEdge {
  readonly parent: NodePosition;
  readonly child: NodePosition;
}

export interface SlotPosition {
  readonly parent: number | null;
  readonly side: 'left' | 'right' | null;
  readonly x: number;
  readonly y: number;
}

export interface TreeLayout {
  readonly nodes: readonly NodePosition[];
  readonly edges: readonly TreeEdge[];
  readonly slots: readonly SlotPosition[];
  readonly width: number;
  readonly height: number;
}

const COLUMN_GAP = 112;
const LEVEL_GAP = 104;
const TOP = 52;
const BOTTOM = 42;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 180;

export function layoutTree(tree: Tree): TreeLayout {
  if (tree === null) {
    return {
      nodes: [],
      edges: [],
      slots: [{ parent: null, side: null, x: MIN_WIDTH / 2, y: MIN_HEIGHT / 2 }],
      width: MIN_WIDTH,
      height: MIN_HEIGHT,
    };
  }

  const nodes: NodePosition[] = [];
  const edges: TreeEdge[] = [];
  let column = 0;
  let maxDepth = 0;

  function place(node: NonNullable<Tree>, depth: number, id: string): NodePosition {
    maxDepth = Math.max(maxDepth, depth);
    const left = node.left === null ? null : place(node.left, depth + 1, `${id}l`);
    const position: NodePosition = { id, key: node.key, x: column * COLUMN_GAP, y: TOP + depth * LEVEL_GAP, depth };
    column += 1;
    const right = node.right === null ? null : place(node.right, depth + 1, `${id}r`);
    nodes.push(position);
    if (left !== null) edges.push({ parent: position, child: left });
    if (right !== null) edges.push({ parent: position, child: right });
    return position;
  }

  place(tree, 0, 'r');
  const width = Math.max(MIN_WIDTH, 160 + (column - 1) * COLUMN_GAP);
  const offset = (width - (column - 1) * COLUMN_GAP) / 2;
  const positionedNodes = nodes.map((node) => ({ ...node, x: node.x + offset }));
  const byId = new Map<string, NodePosition>();
  for (const node of positionedNodes) byId.set(node.id, node);
  const positionedEdges: TreeEdge[] = [];
  for (const edge of edges) {
    const parent = byId.get(edge.parent.id);
    const child = byId.get(edge.child.id);
    if (parent === undefined || child === undefined) {
      throw new Error('Tree layout failed to position an edge');
    }
    positionedEdges.push({ parent, child });
  }
  const slots: SlotPosition[] = [];
  function collectSlots(node: NonNullable<Tree>, id: string): void {
    const parent = byId.get(id);
    if (parent === undefined) {
      throw new Error(`Tree layout could not find node ${node.key}`);
    }
    if (node.left === null) {
      slots.push({ parent: node.key, side: 'left', x: parent.x - COLUMN_GAP / 2, y: parent.y + LEVEL_GAP * 0.72 });
    } else {
      collectSlots(node.left, `${id}l`);
    }
    if (node.right === null) {
      slots.push({ parent: node.key, side: 'right', x: parent.x + COLUMN_GAP / 2, y: parent.y + LEVEL_GAP * 0.72 });
    } else {
      collectSlots(node.right, `${id}r`);
    }
  }
  collectSlots(tree, 'r');

  return {
    nodes: positionedNodes,
    edges: positionedEdges,
    slots,
    width,
    height: Math.max(MIN_HEIGHT, TOP + maxDepth * LEVEL_GAP + LEVEL_GAP * 0.72 + BOTTOM),
  };
}
