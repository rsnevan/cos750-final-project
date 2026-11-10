/**
  The pseudocode shown beside each animation, copied exactly from the V3
  wireframe: language-neutral and recursive, as the lesson plan requires.
  A step's 'line' is an index into one of these lists. Keeping the text and
  the line numbers in one place means they can't drift apart.
 */
export const PSEUDOCODE = Object.freeze({
  search: Object.freeze([
    'search(node, key)',
    '  if node is empty        return NOT FOUND',
    '  if key == node.key      return node',
    '  if key < node.key       return search(node.left, key)',
    '  else                    return search(node.right, key)',
  ]),
  insert: Object.freeze([
    'insert(node, key)',
    '  if node is empty        return new node(key)',
    '  if key < node.key       node.left  = insert(node.left, key)',
    '  else if key > node.key  node.right = insert(node.right, key)',
    '  return node',
  ]),
  traverse: Object.freeze([
    'traverse(node)',
    '  if node is empty   return',
    '  [pre-order:  visit node]',
    '  traverse(node.left)',
    '  [in-order:   visit node]',
    '  traverse(node.right)',
    '  [post-order: visit node]',
  ]),
  delete: Object.freeze([
    'delete(node, key)',
    '  if node is empty         return empty',
    '  if key < node.key        node.left  = delete(node.left, key)',
    '  else if key > node.key   node.right = delete(node.right, key)',
    '  else',
    '    if node.left is empty  return node.right',
    '    if node.right is empty return node.left',
    '    s = minimum(node.right)',
    '    node.key   = s.key',
    '    node.right = delete(node.right, s.key)',
    '  return node',
  ]),
});

// Named line numbers, so step builders never use a bare number.
export const LINES = Object.freeze({
  search: Object.freeze({ empty: 1, equal: 2, goLeft: 3, goRight: 4 }),
  insert: Object.freeze({ empty: 1, goLeft: 2, goRight: 3, duplicate: 4 }),
});