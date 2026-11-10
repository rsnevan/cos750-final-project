/**
 Steps for animating delete (Lesson 5): find the node, name the case, then
 show that case's change, and finish by checking the BST rule.

 In case 3 the successor's key is copied into the node before the old
 successor is removed. The tree never holds a key twice, even for one frame:
 the copy step keeps the original tree and uses `relabel` (show this node with
 the successor's key) and `ghost` (draw the old successor dashed) instead.
 */
import { minPath } from '../extremes';
import { subtree } from '../measures';
import { remove } from '../remove';
import { search } from '../search';
import { inorder, preorder } from '../traversal';
import type { Tree, TreeNode } from '../types';
import { checkBST } from '../validate';
import { LINES } from './pseudocode';
import { makeStep, pathEdges, pathInWords } from './text';
import type { Highlight, Step } from './types';

const L = LINES.delete;

/** Shorthand for one frame. */
function frame(tree: Tree, highlight: Highlight, text: string, line?: number): Step {
  return makeStep({ tree, highlight, text, ...(line === undefined ? {} : { line }) });
}

// The closing check, which only claims the list is sorted when it is.
function checkFrame(tree: Tree): Step {
  if (tree === null) return frame(tree, {}, 'The tree is now empty.', L.done);
  const keys = inorder(tree);
  const list = keys.length <= 12 ? ` ${keys.join(' ')}` : ''; // keep long captions short
  const text = checkBST(tree).valid
    ? `Check: the in-order sequence${list} is still sorted, so the BST rule holds.`
    : `Check: the in-order sequence${list} is not sorted, so the tree breaks the BST rule.`;
  return frame(tree, {}, text, L.done);
}

// The steps for case 3, after the node has been found.
function twoChildrenSteps(tree: Tree, node: TreeNode, after: Tree): Step[] {
  const key = node.key;
  const left = node.left as TreeNode;
  const right = node.right as TreeNode;

  const route = minPath(right); // right child, then left as far as possible
  const successor = route.at(-1) as number;
  const how =
    route.length === 1
      ? `Go right to ${right.key}. It has no left child, so the successor is ${successor}.`
      : `Go right to ${right.key}, then left as far as possible. The successor is ${successor}.`;

  // Fade everything outside the right subtree, where the successor can't be.
  const inRight = new Set(preorder(right));
  const dimmed = preorder(tree).filter((k) => k !== key && !inRight.has(k));

  const oldSuccessor = subtree(right, successor) as TreeNode;
  const childOfOld = oldSuccessor.right; // the successor never has a left child
  const detail =
    childOfOld === null
      ? 'It is a leaf, so this is case 1.'
      : `It has one child, ${childOfOld.key}, so this is case 2: ${childOfOld.key} moves up into its place.`;

  return [
    frame(
      tree,
      { current: key, outlined: [left.key, right.key] },
      `${key} has two children, ${left.key} and ${right.key}. This is case 3.`,
      L.found,
    ),
    frame(
      tree,
      { current: key, visited: route, found: successor, edges: pathEdges([key, ...route]), dimmed },
      `Find the in-order successor: the smallest key in ${key}'s right subtree. ${how}`,
      L.successor,
    ),
    frame(
      tree,
      { relabel: { [key]: successor }, ghost: successor },
      `Copy ${successor} into the node that held ${key}. The old ${successor} is now a duplicate and is about to be removed.`,
      L.copy,
    ),
    frame(after, { found: successor }, `Delete the old ${successor} from the right subtree. ${detail}`, L.removeSuccessor),
  ];
}

// The animation of deleting `key`, using the in-order successor for case 3.
export function deleteSteps(tree: Tree, key: number): Step[] {
  const result = search(tree, key); // also rejects keys that aren't whole numbers

  if (tree === null) {
    return [frame(tree, {}, 'The tree is empty, so there is nothing to delete.', L.empty)];
  }

  if (!result.found) {
    return [
      frame(
        tree,
        {
          visited: result.path,
          edges: pathEdges(result.path),
          slot: { parent: result.endAt, side: result.side },
        },
        `Search for ${key}: ${pathInWords(result.path)}. The ${result.side} side of ${result.endAt} is empty, so ${key} is not in the tree and nothing is deleted.`,
        L.empty,
      ),
    ];
  }

  const node = subtree(tree, key) as TreeNode;
  const after = remove(tree, key).tree;
  const steps: Step[] = [
    frame(
      tree,
      { visited: result.path, current: key, edges: pathEdges(result.path) },
      `First, find ${key} with search: ${pathInWords(result.path)}.`,
    ),
  ];

  if (node.left === null && node.right === null) {
    steps.push(
      frame(tree, { current: key }, `${key} has no children. This is case 1, a leaf.`, L.leftEmpty),
      frame(after, {}, `Remove ${key}. Nothing else moves.`, L.leftEmpty),
    );
  } else if (node.left === null || node.right === null) {
    const child = (node.left ?? node.right) as TreeNode;
    const line = node.left === null ? L.leftEmpty : L.rightEmpty;
    steps.push(
      frame(tree, { current: key, outlined: [child.key] }, `${key} has one child, ${child.key}. This is case 2.`, line),
      frame(
        after,
        { found: child.key },
        `Replace ${key} with its child: ${child.key} and everything below it move up into ${key}'s place.`,
        line,
      ),
    );
  } else {
    steps.push(...twoChildrenSteps(tree, node, after));
  }

  steps.push(checkFrame(after));
  return steps;
}