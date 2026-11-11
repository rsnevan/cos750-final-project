/**
  the tree as text, for screen readers and "Show the tree as text".
  One plain sentence per node, root first, for example
  "50 is the root, with left child 30 and right child 70."
 */
import type { Tree, TreeNode } from './types';


//sentence for one node
function sentenceFor(node: TreeNode, isRoot: boolean): string {
  const children = [
    node.left === null ? null : `left child ${node.left.key}`,
    node.right === null ? null : `right child ${node.right.key}`,
  ].filter((part): part is string => part !== null);
 
  if (isRoot) {
    return children.length > 0
      ? `${node.key} is the root. It has ${children.join(' and ')}.`
      : `${node.key} is the root. It has no children.`;
  }
  return children.length > 0 ? `${node.key} has ${children.join(' and ')}.` : `${node.key} is a leaf.`;
}

// One sentence per node in pre-order. An empty tree gives ["The tree is empty."].
export function describe(tree: Tree): string[] {
  if (tree === null) return ['The tree is empty.'];
  const sentences: string[] = [];
 
  function walk(node: Tree, isRoot: boolean): void {
    if (node === null) return;
    sentences.push(sentenceFor(node, isRoot));
    walk(node.left, false);
    walk(node.right, false);
  }
 
  walk(tree, true);
  return sentences;
}