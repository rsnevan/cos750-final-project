import { writeFileSync } from "node:fs";
var config_default = {
	passThreshold: .8,
	middleBand: .6,
	hintRungs: 3,
	countCorrectAfterSolution: false,
	lesson5NeedsEveryDeleteCase: true,
	retakeOffsets: [
		0,
		7,
		-7,
		13,
		3
	],
	keyRange: [1, 99]
};
// src/content/config.ts
/**
The content settings, loaded from `data/config.json` and checked on load,
so a typo in the settings fails a test instead of reaching a student.
*/
var FIELDS = [
	"passThreshold",
	"middleBand",
	"hintRungs",
	"countCorrectAfterSolution",
	"lesson5NeedsEveryDeleteCase",
	"retakeOffsets",
	"keyRange"
];
function fail$1(field, rule) {
	throw new Error(`config.json: "${field}" ${rule}`);
}
function isRecord$2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isShare(value) {
	return typeof value === "number" && value >= 0 && value <= 1;
}
function validateConfig(raw) {
	if (!isRecord$2(raw)) throw new Error("config.json must hold one object of settings");
	for (const field of FIELDS) if (!(field in raw)) fail$1(field, "is missing");
	for (const field of Object.keys(raw)) if (!FIELDS.includes(field)) fail$1(field, `is not a setting (the settings are ${FIELDS.join(", ")})`);
	const { passThreshold, middleBand, hintRungs, countCorrectAfterSolution, lesson5NeedsEveryDeleteCase, retakeOffsets, keyRange } = raw;
	if (!isShare(passThreshold) || passThreshold === 0) fail$1("passThreshold", "must be a share above 0 and at most 1, such as 0.8 for 80%");
	if (!isShare(middleBand) || middleBand >= passThreshold) fail$1("middleBand", "must be a share from 0 up to, but not including, passThreshold");
	if (!Number.isInteger(hintRungs) || hintRungs < 1 || hintRungs > 3) fail$1("hintRungs", "must be 1, 2 or 3 (nudge, highlight, worked solution)");
	if (typeof countCorrectAfterSolution !== "boolean") fail$1("countCorrectAfterSolution", "must be true or false");
	if (typeof lesson5NeedsEveryDeleteCase !== "boolean") fail$1("lesson5NeedsEveryDeleteCase", "must be true or false");
	if (!Array.isArray(retakeOffsets) || retakeOffsets.length === 0 || !retakeOffsets.every(Number.isInteger) || retakeOffsets[0] !== 0 || new Set(retakeOffsets).size !== retakeOffsets.length) fail$1("retakeOffsets", "must be whole numbers with no repeats, starting with 0 (the original keys)");
	if (!Array.isArray(keyRange) || keyRange.length !== 2 || !keyRange.every(Number.isInteger) || keyRange[0] < 1 || keyRange[0] >= keyRange[1]) fail$1("keyRange", "must be [smallest, largest]: two whole numbers from 1 up, smallest first");
	return Object.freeze({
		passThreshold,
		middleBand,
		hintRungs,
		countCorrectAfterSolution,
		lesson5NeedsEveryDeleteCase,
		retakeOffsets: Object.freeze([...retakeOffsets]),
		keyRange: Object.freeze([keyRange[0], keyRange[1]])
	});
}
var CONFIG = validateConfig(config_default);
function offsetFor(retake, config = CONFIG) {
	if (!Number.isInteger(retake) || retake < 0) throw new RangeError(`A retake number must be a whole number from 0 up, but got ${retake}`);
	return config.retakeOffsets[retake % config.retakeOffsets.length];
}
// src/content/checks.ts
/**
Small building blocks for checking the shape of JSON content. Each check
takes a value and its path (such as `explore[2].key`), and returns a copy
holding only the fields it knows, or throws a ShapeError naming the path.
Internal to the content module.
*/
var ShapeError = class extends Error {};
function bad(path, rule) {
	throw new ShapeError(path === "" ? rule : `${path} ${rule}`);
}
function at(path, field) {
	return path === "" ? field : `${path}.${field}`;
}
function isRecord$1(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
var text = (value, path) => {
	if (typeof value !== "string" || value.trim() === "") bad(path, "must be text");
	return value;
};
var plainText = (value, path) => {
	text(value, path);
	if (/[{}]/.test(value)) bad(path, "must not contain braces: stage text never changes keys, so write 60, not {60}");
	return value;
};
var int = (value, path) => {
	if (!Number.isInteger(value)) bad(path, "must be a whole number");
	return value;
};
var positiveInt = (value, path) => {
	if (!Number.isInteger(value) || value < 1) bad(path, "must be a whole number from 1 up");
	return value;
};
var bool = (value, path) => {
	if (typeof value !== "boolean") bad(path, "must be true or false");
	return value;
};
function literal(...allowed) {
	return (value, path) => {
		if (!allowed.includes(value)) bad(path, `must be one of ${allowed.map((a) => JSON.stringify(a)).join(", ")}`);
		return value;
	};
}
function list(check, { min = 0, max = Infinity } = {}) {
	return (value, path) => {
		if (!Array.isArray(value)) bad(path, "must be a list");
		if (value.length < min) bad(path, `must have at least ${min} ${min === 1 ? "entry" : "entries"}`);
		if (value.length > max) bad(path, `must have at most ${max} entries`);
		return value.map((entry, i) => check(entry, `${path}[${i}]`));
	};
}
var intList = (options = {}) => list(int, options);
function tuple(...checks) {
	return (value, path) => {
		if (!Array.isArray(value) || value.length !== checks.length) bad(path, `must be a list of ${checks.length}`);
		return checks.map((check, i) => check(value[i], `${path}[${i}]`));
	};
}
function keyedByNode(check) {
	return (value, path) => {
		if (!isRecord$1(value)) bad(path, "must be an object keyed by node keys");
		const out = {};
		for (const [key, entry] of Object.entries(value)) {
			if (!/^-?\d+$/.test(key)) bad(at(path, key), "is not a whole-number key");
			out[key] = check(entry, at(path, key));
		}
		return out;
	};
}
function object(required, optional = {}) {
	const known = [...Object.keys(required), ...Object.keys(optional)];
	return (value, path) => {
		if (!isRecord$1(value)) bad(path, "must be an object");
		for (const field of Object.keys(value)) if (!known.includes(field)) bad(at(path, field), `is not a field here (the fields are ${known.join(", ")})`);
		const out = {};
		for (const [field, check] of Object.entries(required)) {
			if (!(field in value)) bad(at(path, field), "is missing");
			out[field] = check(value[field], at(path, field));
		}
		for (const [field, check] of Object.entries(optional)) if (field in value && value[field] !== void 0) out[field] = check(value[field], at(path, field));
		return out;
	};
}
function kinded(field, kinds) {
	return (value, path) => {
		if (!isRecord$1(value)) bad(path, "must be an object");
		const kind = value[field];
		const check = typeof kind === "string" && Object.hasOwn(kinds, kind) ? kinds[kind] : void 0;
		if (check === void 0) bad(at(path, field), `must be one of ${Object.keys(kinds).map((k) => JSON.stringify(k)).join(", ")}`);
		const { [field]: _, ...rest } = value;
		return {
			[field]: kind,
			...check(rest, path)
		};
	};
}
function nullable(check) {
	return (value, path) => value === null ? null : check(value, path);
}
function refine(check, rule) {
	return (value, path) => {
		const out = check(value, path);
		rule(out, path);
		return out;
	};
}
function answerInRange(value, path) {
	if (value.answer !== null && (value.answer < 0 || value.answer >= value.options.length)) bad(at(path, "answer"), `must be one of the ${value.options.length} options, counting from 0`);
}
var shape = (value, path) => {
	if (!Array.isArray(value) || value.length < 1 || value.length > 3) bad(path, "must be [key], [key, left] or [key, left, right]");
	return value.map((part, i) => i === 0 ? int(part, `${path}[0]`) : nullable(shape)(part, `${path}[${i}]`));
};
function deepFreeze$1(value) {
	if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
		for (const inner of Object.values(value)) deepFreeze$1(inner);
		Object.freeze(value);
	}
	return value;
}
var final_default = {
	title: "Final test",
	minutes: 10,
	summary: "Ten questions on a new tree. No hints, no timer, and you can retake it with new numbers.",
	banner: "No hints and no timer. Take your time.",
	firstNote: "This is a new tree, U. You will see full explanations and replays after the last question.",
	retakeNote: "This retake uses new numbers on the same tree shape.",
	outcomes: [
		{
			"id": "LO1",
			"name": "Name the parts of a tree",
			"lectureQuestion": "Why is height counted in edges rather than nodes?"
		},
		{
			"id": "LO2",
			"name": "Tell a valid BST from an invalid one",
			"lectureQuestion": "Why is checking a node against its parent not enough to prove a tree is a BST?"
		},
		{
			"id": "LO3",
			"name": "Trace a search",
			"lectureQuestion": "What happens to search time if the keys are inserted in sorted order?"
		},
		{
			"id": "LO4",
			"name": "Insert a key, and find the minimum and maximum",
			"lectureQuestion": "Why do new keys always become leaves?"
		},
		{
			"id": "LO5",
			"name": "Write the three traversal orders",
			"lectureQuestion": "Where would each traversal order be useful in a real program?"
		},
		{
			"id": "LO6",
			"name": "Delete a key in all three cases",
			"lectureQuestion": "Why does delete use the in-order successor, instead of just moving one of the children up?"
		}
	],
	descriptors: [
		{
			"name": "Excellent",
			"min": 9,
			"requires": ["final-delete-20"],
			"meaning": "You apply all six outcomes accurately, including the two-children delete."
		},
		{
			"name": "Good",
			"min": 7,
			"meaning": "You apply most of the ideas accurately, with small slips."
		},
		{
			"name": "Satisfactory",
			"min": 5,
			"meaning": "You handle the main operations correctly, with some gaps."
		},
		{
			"name": "Limited",
			"min": 0,
			"meaning": "There are some gaps. The lecture will cover the missing ideas."
		}
	],
	items: [
		{
			"id": "final-root-leaves-height",
			"outcome": "LO1",
			"tree": "U",
			"ask": {
				"kind": "rootAndLeaves",
				"withHeight": true
			},
			"prompt": "Click the root and every leaf of tree U, and give the height of U.",
			"hints": [],
			"explanation": "Root {root}; leaves {leaves}; height {height}: the longest path, {35}, {20}, {25}, {22}, has {height} edges."
		},
		{
			"id": "final-invalid-v",
			"outcome": "LO2",
			"tree": "V",
			"ask": { "kind": "validity" },
			"prompt": "Tree V: is it a valid BST? If not, click the node that breaks the rule.",
			"hints": [],
			"explanation": "Invalid. {35} is larger than {30} but sits on {30}'s left side."
		},
		{
			"id": "final-valid-w",
			"outcome": "LO2",
			"tree": "W",
			"ask": { "kind": "validity" },
			"prompt": "Tree W: is it a valid BST? Pick the reason.",
			"parts": [{
				"type": "pick",
				"options": [
					"Valid: every key is on the correct side of every ancestor",
					"Invalid: {20} is larger than {15}",
					"Invalid: {35} is smaller than {40}",
					"Valid: each parent has at most two children"
				],
				"answer": 0,
				"shuffle": true
			}],
			"hints": [],
			"explanation": "Valid. {20} is larger than {15} and smaller than {30}; {35} is smaller than {40} and larger than {30}."
		},
		{
			"id": "final-search-47",
			"outcome": "LO3",
			"tree": "U",
			"ask": {
				"kind": "searchPath",
				"key": 47
			},
			"prompt": "Click the nodes visited when searching for {47} in tree U, in order. Then give the result.",
			"hints": [],
			"explanation": "The search visits {path}, then reaches the empty {side} side of {endAt}, so {47} is not found."
		},
		{
			"id": "final-insert-55",
			"outcome": "LO4",
			"tree": "U",
			"ask": {
				"kind": "insertSlot",
				"key": 55
			},
			"prompt": "Insert {55} into tree U. Where does it go?",
			"hints": [],
			"explanation": "Searching for {55} visits {path} and stops at the empty {side} side of {endAt}, so {55} becomes the {side} child of {endAt}."
		},
		{
			"id": "final-min-max",
			"outcome": "LO4",
			"tree": "U",
			"ask": {
				"kind": "minMax",
				"find": ["min", "max"]
			},
			"prompt": "Click the minimum key of U, then the maximum key.",
			"hints": [],
			"explanation": "Minimum {min} (go left until you cannot). Maximum {max} (go right until you cannot)."
		},
		{
			"id": "final-in-order",
			"outcome": "LO5",
			"tree": "U",
			"ask": {
				"kind": "traversal",
				"order": "in"
			},
			"prompt": "Write the in-order sequence for tree U.",
			"hints": [],
			"explanation": "In-order for tree U: {sequence}."
		},
		{
			"id": "final-post-order",
			"outcome": "LO5",
			"tree": "U",
			"ask": {
				"kind": "traversal",
				"order": "post"
			},
			"prompt": "Write the post-order sequence for tree U.",
			"hints": [],
			"explanation": "Post-order for tree U: {sequence}."
		},
		{
			"id": "final-delete-25",
			"outcome": "LO6",
			"tree": "U",
			"ask": {
				"kind": "delete",
				"key": 25,
				"result": {
					"options": [
						"{22} becomes the right child of {20}",
						"{22} becomes the left child of {20}",
						"{20} is removed as well",
						"{22} is removed and {25} stays"
					],
					"answer": 0
				}
			},
			"prompt": "Delete {25} from tree U.",
			"hints": [],
			"explanation": "{caseName}. {22} becomes the right child of {20}."
		},
		{
			"id": "final-delete-20",
			"outcome": "LO6",
			"tree": "U",
			"ask": {
				"kind": "delete",
				"key": 20,
				"successor": true,
				"result": {
					"options": [
						"The node becomes {22}, with left child {10} and right child {25}",
						"The node becomes {25}, with left child {10} and right child {22}",
						"The node becomes {10}, with right child {25}",
						"{25} moves up and {22} is removed"
					],
					"answer": 0
				}
			},
			"prompt": "Delete {20} from tree U, using the in-order successor.",
			"hints": [],
			"explanation": "{caseName}. The successor is {successor}: go right to {25}, then left as far as you can. Copy {successor} into the node and remove the old {successor}."
		}
	]
};
// src/engine/keys.ts
function assertWholeNumber(key) {
	if (!Number.isInteger(key)) throw new RangeError(`Keys must be whole numbers, but got ${String(key)}`);
}
// src/engine/node.ts
function createNode(key, left = null, right = null) {
	assertWholeNumber(key);
	return Object.freeze({
		key,
		left,
		right
	});
}
function fromShape(shape) {
	const seen = /* @__PURE__ */ new Set();
	function build(part) {
		if (part === null || part === void 0) return null;
		const [key, left, right] = part;
		if (seen.has(key)) throw new Error(`Shape has a duplicate key ${key}`);
		seen.add(key);
		return createNode(key, build(left), build(right));
	}
	return build(shape);
}
// src/engine/insert.ts
/**
insert and build (Lesson 3).
A new key always becomes a leaf at the empty spot where a search for it
stops. No existing node moves. Inserting an existing key changes nothing.
*/
function insert(tree, key) {
	if (tree === null) return {
		tree: createNode(key),
		added: true
	};
	if (key === tree.key) return {
		tree,
		added: false
	};
	if (key < tree.key) {
		const below = insert(tree.left, key);
		if (!below.added) return {
			tree,
			added: false
		};
		return {
			tree: createNode(tree.key, below.tree, tree.right),
			added: true
		};
	}
	const below = insert(tree.right, key);
	if (!below.added) return {
		tree,
		added: false
	};
	return {
		tree: createNode(tree.key, tree.left, below.tree),
		added: true
	};
}
function build(keys) {
	return keys.reduce((tree, key) => insert(tree, key).tree, null);
}
// src/engine/traversal.ts
function walk(tree, order, visited) {
	if (tree === null) return;
	if (order === "pre") visited.push(tree.key);
	walk(tree.left, order, visited);
	if (order === "in") visited.push(tree.key);
	walk(tree.right, order, visited);
	if (order === "post") visited.push(tree.key);
}
function preorder(tree) {
	return traverse(tree, "pre");
}
function inorder(tree) {
	return traverse(tree, "in");
}
function traverse(tree, order) {
	if (order !== "pre" && order !== "in" && order !== "post") throw new RangeError(`Unknown traversal order "${String(order)}". Use 'pre', 'in' or 'post'.`);
	const visited = [];
	walk(tree, order, visited);
	return visited;
}
// src/engine/search.ts
/**
search, the core algorithm (Lesson 2).
Compare with the current node: equal means found, smaller goes left,
larger goes right. Reaching an empty spot means not found.
*/
function search(tree, key) {
	assertWholeNumber(key);
	const path = [];
	let node = tree;
	let endAt = null;
	let side = null;
	while (node !== null) {
		path.push(node.key);
		if (key === node.key) return {
			path,
			found: true,
			endAt: null,
			side: null
		};
		endAt = node.key;
		side = key < node.key ? "left" : "right";
		node = side === "left" ? node.left : node.right;
	}
	return {
		path,
		found: false,
		endAt,
		side
	};
}
// src/engine/extremes.ts
function PathToEnd(tree, side) {
	const path = [];
	let node = tree;
	while (node !== null) {
		path.push(node.key);
		node = side === "left" ? node.left : node.right;
	}
	return path;
}
function min(tree) {
	return minPath(tree).at(-1) ?? null;
}
function minPath(tree) {
	return PathToEnd(tree, "left");
}
function maxPath(tree) {
	return PathToEnd(tree, "right");
}
// src/engine/measures.ts
/**
tree vocabulary and measures (Lesson 1, and helpers for Lesson 5).
Height and depth count edges: a single node has height 0, the empty tree -1.
*/
function locate(tree, key, parent = null, depth = 0) {
	if (tree === null) return null;
	if (tree.key === key) return {
		node: tree,
		parent,
		depth
	};
	return locate(tree.left, key, tree, depth + 1) ?? locate(tree.right, key, tree, depth + 1);
}
function find(tree, key) {
	assertWholeNumber(key);
	return locate(tree, key);
}
function size(tree) {
	if (tree === null) return 0;
	return 1 + size(tree.left) + size(tree.right);
}
function height(tree) {
	if (tree === null) return -1;
	return 1 + Math.max(height(tree.left), height(tree.right));
}
function depth(tree, key) {
	return find(tree, key)?.depth ?? null;
}
function leaves(tree) {
	if (tree === null) return [];
	if (tree.left === null && tree.right === null) return [tree.key];
	return [...leaves(tree.left), ...leaves(tree.right)];
}
function subtree(tree, key) {
	return find(tree, key)?.node ?? null;
}
// src/engine/validate.ts
function collectOffenders(tree, lo, hi, offenders) {
	if (tree === null) return;
	const tooSmall = lo !== null && tree.key <= lo;
	const tooLarge = hi !== null && tree.key >= hi;
	if (tooSmall || tooLarge) offenders.push(tree.key);
	const leftHi = hi === null ? tree.key : Math.min(hi, tree.key);
	const rightLo = lo === null ? tree.key : Math.max(lo, tree.key);
	collectOffenders(tree.left, lo, leftHi, offenders);
	collectOffenders(tree.right, rightLo, hi, offenders);
}
function findOffenders(tree) {
	const offenders = [];
	collectOffenders(tree, null, null, offenders);
	return offenders;
}
function checkBST(tree) {
	const offender = findOffenders(tree)[0] ?? null;
	return {
		valid: offender === null,
		offender
	};
}
// src/engine/remove.ts
/**
delete (Lesson 5).
Find the node with search, then:
- leaf: remove it;
- one child: the child's whole subtree takes its place;
- two children: copy in the in-order successor (the minimum of the right
subtree), then delete the successor's old node from the right subtree.
*/
function successor(tree, key) {
	assertWholeNumber(key);
	let node = tree;
	let nearestLeftTurn = null;
	while (node !== null && node.key !== key) if (key < node.key) {
		nearestLeftTurn = node.key;
		node = node.left;
	} else node = node.right;
	if (node === null) return null;
	if (node.right !== null) return min(node.right);
	return nearestLeftTurn;
}
function remove(tree, key) {
	assertWholeNumber(key);
	return removeFrom(tree, key);
}
var NOT_FOUND = {
	case: null,
	successor: null
};
function removeFrom(tree, key) {
	if (tree === null) return {
		tree: null,
		...NOT_FOUND
	};
	if (key < tree.key) {
		const below = removeFrom(tree.left, key);
		if (below.case === null) return {
			tree,
			...NOT_FOUND
		};
		return {
			...below,
			tree: createNode(tree.key, below.tree, tree.right)
		};
	}
	if (key > tree.key) {
		const below = removeFrom(tree.right, key);
		if (below.case === null) return {
			tree,
			...NOT_FOUND
		};
		return {
			...below,
			tree: createNode(tree.key, tree.left, below.tree)
		};
	}
	if (tree.left === null && tree.right === null) return {
		tree: null,
		case: "leaf",
		successor: null
	};
	if (tree.left === null) return {
		tree: tree.right,
		case: "one",
		successor: null
	};
	if (tree.right === null) return {
		tree: tree.left,
		case: "one",
		successor: null
	};
	const next = min(tree.right);
	const rightWithoutNext = removeFrom(tree.right, next).tree;
	return {
		tree: createNode(next, tree.left, rightWithoutNext),
		case: "two",
		successor: next
	};
}
// src/engine/compare.ts
/**
comparing and re-keying trees.
sameTree checks answers such as "build this tree"; mapKeys gives
retakes new keys while keeping the same shape.
*/
/**
Apply 'f' to every key, keeping the shape. 'f' must be strictly increasing,
such as adding a fixed offset, so the result is still a valid BST.
*/
function mapKeys(tree, f) {
	const keys = preorder(tree).sort((a, b) => a - b);
	const newKeyFor = /* @__PURE__ */ new Map();
	let previous = null;
	for (const key of keys) {
		const mapped = f(key);
		if (previous !== null && !(mapped > previous)) throw new RangeError(`mapKeys needs a strictly increasing function, but it gave ${mapped} after ${previous}`);
		newKeyFor.set(key, mapped);
		previous = mapped;
	}
	function rebuild(node) {
		if (node === null) return null;
		return createNode(newKeyFor.get(node.key), rebuild(node.left), rebuild(node.right));
	}
	return rebuild(tree);
}
Object.freeze({
	search: Object.freeze([
		"search(node, key)",
		"  if node is empty        return NOT FOUND",
		"  if key == node.key      return node",
		"  if key < node.key       return search(node.left, key)",
		"  else                    return search(node.right, key)"
	]),
	insert: Object.freeze([
		"insert(node, key)",
		"  if node is empty        return new node(key)",
		"  if key < node.key       node.left  = insert(node.left, key)",
		"  else if key > node.key  node.right = insert(node.right, key)",
		"  return node"
	]),
	traverse: Object.freeze([
		"traverse(node)",
		"  if node is empty   return",
		"  [pre-order:  visit node]",
		"  traverse(node.left)",
		"  [in-order:   visit node]",
		"  traverse(node.right)",
		"  [post-order: visit node]"
	]),
	delete: Object.freeze([
		"delete(node, key)",
		"  if node is empty         return empty",
		"  if key < node.key        node.left  = delete(node.left, key)",
		"  else if key > node.key   node.right = delete(node.right, key)",
		"  else",
		"    if node.left is empty  return node.right",
		"    if node.right is empty return node.left",
		"    s = minimum(node.right)",
		"    node.key   = s.key",
		"    node.right = delete(node.right, s.key)",
		"  return node"
	])
});
var LINES = Object.freeze({
	search: Object.freeze({
		empty: 1,
		equal: 2,
		goLeft: 3,
		goRight: 4
	}),
	insert: Object.freeze({
		empty: 1,
		goLeft: 2,
		goRight: 3,
		duplicate: 4
	}),
	traverse: Object.freeze({
		empty: 1,
		pre: 2,
		left: 3,
		in: 4,
		right: 5,
		post: 6
	}),
	delete: Object.freeze({
		empty: 1,
		goLeft: 2,
		goRight: 3,
		found: 4,
		leftEmpty: 5,
		rightEmpty: 6,
		successor: 7,
		copy: 8,
		removeSuccessor: 9,
		done: 10
	})
});
// src/engine/steps/text.ts
function plural$1(count, word) {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}
function pathInWords(path) {
	if (path.length <= 8) return path.join(", ");
	return `${path.length} nodes, from ${path[0]} down to ${path.at(-1)}`;
}
function pathEdges$1(path) {
	const edges = [];
	for (let i = 1; i < path.length; i++) edges.push([path[i - 1], path[i]]);
	return edges;
}
/**
Make a step and freeze it, its highlight and every list inside, so the
visualiser's JavaScript can't change a frame by accident. Fields that are
'undefined' are left out, so a highlight only has the fields that apply.
*/
function makeStep(step) {
	const highlight = {};
	for (const [name, value] of Object.entries(step.highlight)) {
		if (value === void 0) continue;
		highlight[name] = deepFreeze(value);
	}
	const frozen = {
		tree: step.tree,
		highlight: Object.freeze(highlight),
		text: step.text,
		...step.line === void 0 ? {} : { line: step.line }
	};
	return Object.freeze(frozen);
}
function deepFreeze(value) {
	if (value !== null && typeof value === "object") {
		for (const inner of Object.values(value)) deepFreeze(inner);
		Object.freeze(value);
	}
	return value;
}
// src/engine/steps/comparisons.ts
/**
The step for comparing 'key' with the node at 'path[index]' and moving on.
'goLeft' and 'goRight' are the pseudocode lines for each direction, which
differ between search, insert and delete.
*/
function comparisonStep(tree, key, path, index, lines) {
	const nodeKey = path[index];
	const visited = path.slice(0, index + 1);
	const goesLeft = key < nodeKey;
	const where = index === 0 ? `Start at the root, ${nodeKey}.` : `Now at ${nodeKey}.`;
	return makeStep({
		tree,
		highlight: {
			visited,
			current: nodeKey,
			edges: pathEdges$1(visited)
		},
		text: `${where} ${key} is ${goesLeft ? "smaller" : "larger"} than ${nodeKey}, so go ${goesLeft ? "left" : "right"}.`,
		line: goesLeft ? lines.goLeft : lines.goRight
	});
}
// src/engine/steps/searchSteps.ts
/**
Steps for animating search (Lesson 2): one step per comparison, then one
for the empty spot if the key isn't there.
*/
var L$2 = LINES.search;
function searchSteps(tree, key) {
	const result = search(tree, key);
	if (tree === null) return [makeStep({
		tree,
		highlight: {
			visited: [],
			edges: [],
			slot: {
				parent: null,
				side: null
			}
		},
		text: `The tree is empty, so ${key} is not in the tree.`,
		line: L$2.empty
	})];
	const steps = result.path.map((nodeKey, i) => {
		if (nodeKey !== key) return comparisonStep(tree, key, result.path, i, L$2);
		const visited = result.path.slice(0, i + 1);
		return makeStep({
			tree,
			highlight: {
				visited,
				found: key,
				edges: pathEdges$1(visited)
			},
			text: `${key} equals ${nodeKey}: found it after ${plural$1(i + 1, "comparison")}.`,
			line: L$2.equal
		});
	});
	if (!result.found) steps.push(makeStep({
		tree,
		highlight: {
			visited: result.path,
			edges: pathEdges$1(result.path),
			slot: {
				parent: result.endAt,
				side: result.side
			}
		},
		text: `The ${result.side} side of ${result.endAt} is empty, so ${key} is not in the tree. ${plural$1(result.path.length, "node")} visited.`,
		line: L$2.empty
	}));
	return steps;
}
// src/engine/steps/insertSteps.ts
/**
Steps for animating insert (Lesson 3): the same comparisons as search,
then the empty spot, then the new tree with the new leaf.
*/
var L$1 = LINES.insert;
function insertSteps(tree, key) {
	const result = search(tree, key);
	if (tree === null) return [makeStep({
		tree,
		highlight: { slot: {
			parent: null,
			side: null
		} },
		text: `The tree is empty, so ${key} goes at the root.`,
		line: L$1.empty
	}), makeStep({
		tree: insert(tree, key).tree,
		highlight: {
			found: key,
			edges: []
		},
		text: `${key} becomes the root. It is the only node.`,
		line: L$1.empty
	})];
	const steps = result.path.map((nodeKey, i) => {
		if (nodeKey !== key) return comparisonStep(tree, key, result.path, i, L$1);
		const visited = result.path.slice(0, i + 1);
		return makeStep({
			tree,
			highlight: {
				visited,
				found: key,
				edges: pathEdges$1(visited)
			},
			text: `${key} is already in the tree. Duplicates are not added, so nothing changes.`,
			line: L$1.duplicate
		});
	});
	if (result.found) return steps;
	steps.push(makeStep({
		tree,
		highlight: {
			visited: result.path,
			edges: pathEdges$1(result.path),
			slot: {
				parent: result.endAt,
				side: result.side
			}
		},
		text: `The ${result.side} side of ${result.endAt} is empty. This is where ${key} goes.`,
		line: L$1.empty
	}), makeStep({
		tree: insert(tree, key).tree,
		highlight: {
			found: key,
			edges: pathEdges$1([...result.path, key])
		},
		text: `${key} becomes the ${result.side} child of ${result.endAt}. It is a new leaf, and no other node moved.`,
		line: L$1.empty
	}));
	return steps;
}
// src/engine/steps/buildSteps.ts
/**
Steps for animating building a tree from a list of keys (Lesson 3).
One frame per key, showing the tree after that key is inserted.

The comparisons are written in words ("smaller than 40") rather than
symbols ("< 40"), because every caption is also announced by screen readers
and read aloud by narration, which don't say symbols reliably.
*/
/**
The comparisons along a path, kept short enough to read aloud:
- up to 3 (every lesson tree): "10 is smaller than 40, then smaller than 20";
- 4 to 6: "30 is compared with 50, 10, 40 and 20";
- more: "90 is compared with 8 nodes on the way down".
*/
function comparisonsInWords(key, path) {
	if (path.length <= 3) return path.map((nodeKey, i) => {
		const relation = `${key < nodeKey ? "smaller" : "larger"} than ${nodeKey}`;
		return i === 0 ? `${key} is ${relation}` : `then ${relation}`;
	}).join(", ");
	if (path.length <= 6) return `${key} is compared with ${path.slice(0, -1).join(", ")} and ${path.at(-1)}`;
	return `${key} is compared with ${path.length} nodes on the way down`;
}
/** The animation of inserting `keys` in order into an empty tree. */
function buildSteps(keys) {
	if (keys.length === 0) return [makeStep({
		tree: null,
		highlight: {},
		text: "There are no keys to insert, so the tree is empty."
	})];
	const steps = [];
	let tree = null;
	for (const key of keys) {
		const result = search(tree, key);
		if (result.found) {
			steps.push(makeStep({
				tree,
				highlight: {
					visited: result.path,
					found: key,
					edges: pathEdges$1(result.path)
				},
				text: `Insert ${key}. ${key} is already in the tree, so nothing changes.`
			}));
			continue;
		}
		const how = tree === null ? `The tree is empty, so ${key} becomes the root.` : `${comparisonsInWords(key, result.path)}: the ${result.side} side of ${result.endAt} is empty, so ${key} goes there.`;
		tree = insert(tree, key).tree;
		steps.push(makeStep({
			tree,
			highlight: {
				visited: result.path,
				found: key,
				edges: pathEdges$1([...result.path, key])
			},
			text: `Insert ${key}. ${how}`
		}));
	}
	return steps;
}
// src/engine/steps/extremeSteps.ts
/**
Steps for animating finding the minimum or maximum (Lesson 3): keep going
left (or right) until there is no child on that side. Wording from the V3
wireframe. There is no pseudocode for this one, so steps have no `line`.
*/
function extremeSteps(tree, which) {
	if (which !== "min" && which !== "max") throw new RangeError(`extremeSteps needs 'min' or 'max', but got ${String(which)}`);
	const side = which === "min" ? "left" : "right";
	const name = which === "min" ? "minimum" : "maximum";
	if (tree === null) return [makeStep({
		tree,
		highlight: {},
		text: `The tree is empty, so it has no ${name}.`
	})];
	const path = which === "min" ? minPath(tree) : maxPath(tree);
	return path.map((key, i) => {
		const visited = path.slice(0, i + 1);
		const edges = pathEdges$1(visited);
		if (i === path.length - 1) return makeStep({
			tree,
			highlight: {
				visited,
				found: key,
				edges
			},
			text: `${key} has no ${side} child, so ${key} is the ${name}. No comparisons were needed.`
		});
		const where = i === 0 ? `Start at the root, ${key}.` : `At ${key}.`;
		return makeStep({
			tree,
			highlight: {
				visited,
				current: key,
				edges
			},
			text: `${where} It has a ${side} child, so keep going ${side}.`
		});
	});
}
// src/engine/steps/traversalSteps.ts
var WHEN = {
	pre: "before its children",
	in: "between its left and right subtrees",
	post: "after both of its children"
};
function isSorted(keys) {
	return keys.every((key, i) => i === 0 || keys[i - 1] < key);
}
/**
The animation of a pre-, in- or post-order traversal. One step per node.
The last in-order step says whether the list is sorted, which is only true
for a valid BST, so invalid trees (like X in Lesson 1) are described honestly.
*/
function traversalSteps(tree, order) {
	const sequence = traverse(tree, order);
	if (tree === null) return [makeStep({
		tree,
		highlight: {
			dots: order,
			output: []
		},
		text: "The tree is empty, so there is nothing to visit.",
		line: LINES.traverse.empty
	})];
	return sequence.map((key, i) => {
		const soFar = sequence.slice(0, i + 1);
		let text = `Visit ${key}: ${order}-order writes a node ${WHEN[order]}.`;
		if (i === sequence.length - 1) {
			text += " Every node has been visited exactly once.";
			if (order === "in") text += isSorted(sequence) ? " The list is sorted." : " The list is not sorted, so this tree breaks the BST rule.";
		}
		return makeStep({
			tree,
			highlight: {
				visited: soFar,
				current: key,
				marker: {
					key,
					position: order
				},
				dots: order,
				output: soFar
			},
			text,
			line: LINES.traverse[order]
		});
	});
}
// src/engine/steps/deleteSteps.ts
/**
Steps for animating delete (Lesson 5): find the node, name the case, then
show that case's change, and finish by checking the BST rule.

In case 3 the successor's key is copied into the node before the old
successor is removed. The tree never holds a key twice, even for one frame:
the copy step keeps the original tree and uses `relabel` (show this node with
the successor's key) and `ghost` (draw the old successor dashed) instead.
*/
var L = LINES.delete;
/** Shorthand for one frame. */
function frame(tree, highlight, text, line) {
	return makeStep({
		tree,
		highlight,
		text,
		...line === void 0 ? {} : { line }
	});
}
function checkFrame(tree) {
	if (tree === null) return frame(tree, {}, "The tree is now empty.", L.done);
	const keys = inorder(tree);
	const list = keys.length <= 12 ? ` ${keys.join(" ")}` : "";
	return frame(tree, {}, checkBST(tree).valid ? `Check: the in-order sequence${list} is still sorted, so the BST rule holds.` : `Check: the in-order sequence${list} is not sorted, so the tree breaks the BST rule.`, L.done);
}
function twoChildrenSteps(tree, node, after) {
	const key = node.key;
	const left = node.left;
	const right = node.right;
	const route = minPath(right);
	const successor = route.at(-1);
	const how = route.length === 1 ? `Go right to ${right.key}. It has no left child, so the successor is ${successor}.` : `Go right to ${right.key}, then left as far as possible. The successor is ${successor}.`;
	const inRight = new Set(preorder(right));
	const dimmed = preorder(tree).filter((k) => k !== key && !inRight.has(k));
	const childOfOld = subtree(right, successor).right;
	const detail = childOfOld === null ? "It is a leaf, so this is case 1." : `It has one child, ${childOfOld.key}, so this is case 2: ${childOfOld.key} moves up into its place.`;
	return [
		frame(tree, {
			current: key,
			outlined: [left.key, right.key]
		}, `${key} has two children, ${left.key} and ${right.key}. This is case 3.`, L.found),
		frame(tree, {
			current: key,
			visited: route,
			found: successor,
			edges: pathEdges$1([key, ...route]),
			dimmed
		}, `Find the in-order successor: the smallest key in ${key}'s right subtree. ${how}`, L.successor),
		frame(tree, {
			relabel: { [key]: successor },
			ghost: successor
		}, `Copy ${successor} into the node that held ${key}. The old ${successor} is now a duplicate and is about to be removed.`, L.copy),
		frame(after, { found: successor }, `Delete the old ${successor} from the right subtree. ${detail}`, L.removeSuccessor)
	];
}
function deleteSteps(tree, key) {
	const result = search(tree, key);
	if (tree === null) return [frame(tree, {}, "The tree is empty, so there is nothing to delete.", L.empty)];
	if (!result.found) return [frame(tree, {
		visited: result.path,
		edges: pathEdges$1(result.path),
		slot: {
			parent: result.endAt,
			side: result.side
		}
	}, `Search for ${key}: ${pathInWords(result.path)}. The ${result.side} side of ${result.endAt} is empty, so ${key} is not in the tree and nothing is deleted.`, L.empty)];
	const node = subtree(tree, key);
	const after = remove(tree, key).tree;
	const steps = [frame(tree, {
		visited: result.path,
		current: key,
		edges: pathEdges$1(result.path)
	}, `First, find ${key} with search: ${pathInWords(result.path)}.`)];
	if (node.left === null && node.right === null) steps.push(frame(tree, { current: key }, `${key} has no children. This is case 1, a leaf.`, L.leftEmpty), frame(after, {}, `Remove ${key}. Nothing else moves.`, L.leftEmpty));
	else if (node.left === null || node.right === null) {
		const child = node.left ?? node.right;
		const line = node.left === null ? L.leftEmpty : L.rightEmpty;
		steps.push(frame(tree, {
			current: key,
			outlined: [child.key]
		}, `${key} has one child, ${child.key}. This is case 2.`, line), frame(after, { found: child.key }, `Replace ${key} with its child: ${child.key} and everything below it move up into ${key}'s place.`, line));
	} else steps.push(...twoChildrenSteps(tree, node, after));
	steps.push(checkFrame(after));
	return steps;
}
// src/content/placeholders.ts
var PLACEHOLDER = /\{(?:(\d+)|([A-Za-z][A-Za-z0-9_]*))\}/g;
function show(value) {
	return typeof value === "object" ? value.join(", ") : String(value);
}
function fillText(template, offset, values = {}) {
	if (!Number.isInteger(offset)) throw new RangeError(`A key offset must be a whole number, but got ${offset}`);
	const filled = template.replace(PLACEHOLDER, (whole, key, name) => {
		if (key !== void 0) return String(Number(key) + offset);
		const value = Object.hasOwn(values, name) ? values[name] : void 0;
		if (value === void 0) throw new Error(`The text "${template}" uses {${name}}, but no value was given for it`);
		return show(value);
	});
	const leftover = template.replace(PLACEHOLDER, "");
	if (leftover.includes("{") || leftover.includes("}")) throw new Error(`The text "${template}" has a brace that isn't a placeholder like {50} or {path}`);
	return filled;
}
var trees_default = {
	T: { "insert": [
		50,
		30,
		70,
		20,
		40,
		60,
		80
	] },
	T2: { "insert": [
		50,
		30,
		70,
		20,
		40,
		60,
		80,
		45
	] },
	U: { "insert": [
		35,
		20,
		50,
		10,
		25,
		45,
		60,
		22
	] },
	X: { "shape": [
		50,
		[30],
		[70, [40]]
	] },
	T55: { "shape": [
		50,
		[
			30,
			null,
			[55]
		],
		[70]
	] },
	V: { "shape": [
		30,
		[
			15,
			null,
			[35]
		],
		[40]
	] },
	W: { "shape": [
		30,
		[
			15,
			null,
			[20]
		],
		[40, [35]]
	] },
	SWAP: { "shape": [
		50,
		[70],
		[30]
	] }
};
// src/content/trees.ts
/**
The named lesson trees, loaded from `data/trees.json` and checked on load.

A tree is either built by inserting keys in order ('insert'), which is how
the valid lesson trees are made, or drawn exactly as written ('shape'),
which is the only way to make the invalid trees in Lesson 1.
*/
var NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function checkShape(value, where) {
	if (!Array.isArray(value) || value.length < 1 || value.length > 3) throw new Error(`${where}: each node must be written [key], [key, left] or [key, left, right]`);
	if (!Number.isInteger(value[0])) throw new Error(`${where}: ${JSON.stringify(value[0])} is not a whole-number key`);
	for (const child of value.slice(1)) if (child !== null) checkShape(child, where);
}
function buildSpec(spec) {
	return "insert" in spec ? build(spec.insert) : fromShape(spec.shape);
}
function checkSpec(name, spec, config) {
	const where = `trees.json: tree "${name}"`;
	if (!NAME.test(name)) throw new Error(`${where}: a name must be a letter followed by letters, digits or _`);
	if (!isRecord(spec)) throw new Error(`${where} must be { "insert": [...] } or { "shape": [...] }`);
	const fields = Object.keys(spec);
	if (fields.length !== 1 || fields[0] !== "insert" && fields[0] !== "shape") throw new Error(`${where} must have exactly one of "insert" or "shape", but has ${fields.join(", ") || "neither"}`);
	let copy;
	if ("insert" in spec) {
		const keys = spec.insert;
		if (!Array.isArray(keys) || keys.length === 0 || !keys.every(Number.isInteger)) throw new Error(`${where}: "insert" must be a list of one or more whole-number keys`);
		if (new Set(keys).size !== keys.length) throw new Error(`${where}: "insert" repeats a key`);
		copy = { insert: Object.freeze([...keys]) };
	} else {
		checkShape(spec.shape, where);
		copy = { shape: spec.shape };
	}
	let keys;
	try {
		keys = preorder(buildSpec(copy));
	} catch (error) {
		throw new Error(`${where}: ${error.message}`);
	}
	const [lo, hi] = config.keyRange;
	const smallest = Math.min(...keys);
	const largest = Math.max(...keys);
	config.retakeOffsets.forEach((offset, retake) => {
		if (smallest + offset < lo || largest + offset > hi) throw new Error(`${where}: on retake ${retake} (offset ${offset}) its keys run from ${smallest + offset} to ${largest + offset}, outside ${lo} to ${hi}`);
	});
	return Object.freeze(copy);
}
function validateTrees(raw, config = CONFIG) {
	if (!isRecord(raw)) throw new Error("trees.json must hold one object of named trees");
	const library = {};
	for (const [name, spec] of Object.entries(raw)) library[name] = checkSpec(name, spec, config);
	return Object.freeze(library);
}
var TREES = validateTrees(trees_default);
function getTree(name, retake = 0) {
	const spec = Object.hasOwn(TREES, name) ? TREES[name] : void 0;
	if (spec === void 0) throw new Error(`There is no tree "${name}" (the trees are ${Object.keys(TREES).join(", ")})`);
	const offset = offsetFor(retake);
	const tree = buildSpec(spec);
	return offset === 0 ? tree : mapKeys(tree, (key) => key + offset);
}
// src/content/context.ts
/**
Shared pieces of the resolver: what it knows about the item being resolved,
key shifting, errors that name the item, and small tree helpers.
Internal to the content module.
*/
function fail(context, message) {
	throw new Error(`${context.label ?? `Item "${context.item.id}"`}: ${message}`);
}
function shiftKey(context, key, where) {
	if (!Number.isInteger(key)) fail(context, `${where}: ${JSON.stringify(key)} is not a whole-number key`);
	const shifted = key + context.offset;
	const [lo, hi] = CONFIG.keyRange;
	if (shifted < lo || shifted > hi) fail(context, `${where}: key ${key} becomes ${shifted} on retake ${context.retake}, outside ${lo} to ${hi}`);
	return shifted;
}
function shiftNode(context, key, where) {
	const shifted = shiftKey(context, key, where);
	if (!context.keys.has(shifted)) fail(context, `${where}: key ${key} is not in the tree`);
	return shifted;
}
function fill(context, values, template, where) {
	try {
		return fillText(template, context.offset, values);
	} catch (error) {
		return fail(context, `${where}: ${error.message}`);
	}
}
function treeFromRef(owner, ref, retake, offset) {
	const name = typeof ref === "string" ? ref : ref.from;
	if (!Object.hasOwn(TREES, name)) fail(owner, `there is no tree "${name}" (the trees are ${Object.keys(TREES).join(", ")})`);
	let tree = getTree(name, retake);
	if (typeof ref === "string") return tree;
	const context = {
		...owner,
		retake,
		offset,
		tree,
		keys: /* @__PURE__ */ new Set()
	};
	for (const key of ref.insert ?? []) {
		const result = insert(tree, shiftKey(context, key, "tree insert"));
		if (!result.added) fail(owner, `tree: ${key} is already in "${name}", so it can't be inserted`);
		tree = result.tree;
	}
	for (const key of ref.delete ?? []) {
		const result = remove(tree, shiftKey(context, key, "tree delete"));
		if (result.case === null) fail(owner, `tree: ${key} is not in "${name}", so it can't be deleted`);
		tree = result.tree;
	}
	return tree;
}
function pathEdges(path) {
	return path.slice(1).map((key, i) => [path[i], key]);
}
function longestPath(tree) {
	if (tree === null) return [];
	const left = longestPath(tree.left);
	const right = longestPath(tree.right);
	return [tree.key, ...right.length > left.length ? right : left];
}
function pathTo(tree, key) {
	if (tree === null) return null;
	if (tree.key === key) return [key];
	const below = pathTo(tree.left, key) ?? pathTo(tree.right, key);
	return below === null ? null : [tree.key, ...below];
}
function outside(tree, key) {
	const inside = new Set(preorder(subtree(tree, key)));
	return preorder(tree).filter((k) => !inside.has(k));
}
function listInWords(keys) {
	if (keys.length <= 1) return keys.join("");
	return `${keys.slice(0, -1).join(", ")} and ${keys.at(-1)}`;
}
function plural(count, word) {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}
function seededRandom(seed) {
	let state = 2166136261;
	for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
	return () => {
		state = state + 1831565813 | 0;
		let t = Math.imul(state ^ state >>> 15, 1 | state);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function shuffledOrder(context, partIndex, n) {
	const random = seededRandom(`${context.item.id}#${context.retake}#${partIndex}`);
	const order = Array.from({ length: n }, (_, i) => i);
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	return order;
}
// src/content/highlights.ts
/**
Highlights for hints and the `base` of a question: presets worked out from
the item's task, or highlights written in the JSON with retake-0 keys.
Internal to the content module.
*/
function presetHighlight(context, preset, where) {
	const { tree } = context;
	const need = (value, what) => {
		if (value === void 0) fail(context, `${where}: the "${preset}" highlight needs a task with ${what}`);
		return value;
	};
	switch (preset) {
		case "path": {
			const path = search(tree, need(context.key, "a key")).path;
			return {
				visited: path,
				edges: pathEdges(path)
			};
		}
		case "otherHalf": {
			const key = need(context.key, "a key");
			if (tree === null || key === tree.key) fail(context, `${where}: the "otherHalf" highlight needs a key other than the root's`);
			const half = key < tree.key ? tree.right : tree.left;
			if (half === null) fail(context, `${where}: the "otherHalf" highlight has nothing to dim`);
			return { dimmed: preorder(half) };
		}
		case "emptySpot": {
			const result = search(tree, need(context.key, "a key"));
			if (result.found) fail(context, `${where}: the "emptySpot" highlight needs a key that is not in the tree`);
			return { slot: {
				parent: result.endAt,
				side: result.side
			} };
		}
		case "longestPath": return { edges: pathEdges(longestPath(tree)) };
		case "leaves": return { outlined: leaves(tree) };
		case "depthHeight": {
			if (context.depthOf === void 0 && context.heightOf === void 0) fail(context, `${where}: the "depthHeight" highlight needs a depthHeight task`);
			const highlight = {};
			if (context.depthOf !== void 0) highlight.edges = pathEdges(pathTo(tree, context.depthOf) ?? []);
			if (context.heightOf !== void 0) highlight.outlined = preorder(subtree(tree, context.heightOf));
			return highlight;
		}
		case "extremePaths": {
			const find = need(context.find, "a minimum or maximum to find");
			const start = context.from === void 0 ? tree : subtree(tree, context.from);
			return { edges: find.flatMap((which) => pathEdges(which === "min" ? minPath(start) : maxPath(start))) };
		}
		case "outsideSubtree": {
			const dimmed = outside(tree, need(context.from ?? context.key, "a subtree (from) or a key"));
			if (dimmed.length === 0) fail(context, `${where}: the "outsideSubtree" highlight has nothing to dim`);
			return { dimmed };
		}
		case "dots": return { dots: need(context.order, "a traversal order") };
		case "children": {
			const node = subtree(tree, need(context.key, "a key"));
			const children = [node?.left?.key, node?.right?.key].filter((key) => key !== void 0);
			return children.length === 0 ? {} : { outlined: children };
		}
		case "rightSubtree": {
			const key = need(context.key, "a key");
			const right = subtree(tree, key)?.right ?? null;
			if (right === null) fail(context, `${where}: the "rightSubtree" highlight needs a key with a right subtree`);
			const dimmed = outside(tree, key);
			return dimmed.length === 0 ? { outlined: preorder(right) } : {
				outlined: preorder(right),
				dimmed
			};
		}
		default: return fail(context, `${where}: there is no highlight preset "${preset}"`);
	}
}
function checkEdge(context, parent, child, where) {
	const node = subtree(context.tree, parent);
	if (node?.left?.key !== child && node?.right?.key !== child) fail(context, `${where}: ${child - context.offset} is not a child of ${parent - context.offset}`);
}
/**
Shift every key in a written highlight, checking each one names a node in
the tree, and fill keys written in its labels (`tags`, `slotLabel`, `edgeLabels`).
*/
function writtenHighlight(context, values, written, where) {
	const node = (key) => shiftNode(context, key, where);
	const nodes = (keys) => keys.map(node);
	const text = (label) => fill(context, values, label, where);
	const edge = (parent, child) => {
		const pair = [node(parent), node(child)];
		checkEdge(context, pair[0], pair[1], where);
		return pair;
	};
	const out = {};
	for (const [field, value] of Object.entries(written)) switch (field) {
		case "visited":
		case "outlined":
		case "dimmed":
		case "output":
			out[field] = nodes(value);
			break;
		case "current":
		case "found":
		case "offender":
		case "ghost":
			out[field] = node(value);
			break;
		case "edges":
			out[field] = value.map(([parent, child]) => edge(parent, child));
			break;
		case "edgeLabels":
			out[field] = value.map(([parent, child, label]) => [...edge(parent, child), text(label)]);
			break;
		case "tags":
			out[field] = Object.fromEntries(Object.entries(value).map(([key, tag]) => [node(Number(key)), text(tag)]));
			break;
		case "relabel":
			out[field] = Object.fromEntries(Object.entries(value).map(([from, to]) => [node(Number(from)), shiftKey(context, to, where)]));
			break;
		case "marker": {
			const marker = value;
			out[field] = {
				key: node(marker.key),
				position: marker.position
			};
			break;
		}
		case "slot": {
			const slot = value;
			const parent = node(slot.parent);
			if (subtree(context.tree, parent)?.[slot.side] !== null) fail(context, `${where}: the ${slot.side} side of ${slot.parent} is not an empty spot`);
			out[field] = {
				parent,
				side: slot.side
			};
			break;
		}
		case "slotLabel":
			out[field] = text(value);
			break;
		case "dots":
			out[field] = value;
			break;
		default: fail(context, `${where}: a highlight has no field "${field}"`);
	}
	return out;
}
function anyHighlight(context, values, spec, where) {
	return typeof spec === "string" ? presetHighlight(context, spec, where) : writtenHighlight(context, values, spec, where);
}
// src/content/parts.ts
function numberPick(label, answer) {
	const top = Math.max(3, answer + 1);
	return {
		type: "pick",
		label,
		options: Array.from({ length: top + 1 }, (_, i) => String(i)),
		answer
	};
}
function clickAnswer$1(context, values, spec, where) {
	const { answer, mode } = spec;
	if (typeof answer === "string") {
		const value = Object.hasOwn(values, answer) ? values[answer] : void 0;
		if (value === void 0) fail(context, `${where}: this task works out no value called "${answer}"`);
		if (mode === "one" && typeof value !== "number") fail(context, `${where}: "${answer}" is not a single key, so it can't answer a click-one part`);
		if (mode !== "one" && !Array.isArray(value)) fail(context, `${where}: "${answer}" is not a list of keys, so it can't answer a click-${mode} part`);
		return Array.isArray(value) ? [...value] : value;
	}
	if (mode === "one") {
		if (typeof answer !== "number") fail(context, `${where}: a click-one answer is one key`);
		return shiftNode(context, answer, where);
	}
	if (!Array.isArray(answer)) fail(context, `${where}: a click-${mode} answer is a list of keys`);
	return answer.map((key) => shiftNode(context, key, where));
}
function buildPart(context, values, spec, index) {
	const where = `part ${index + 1}`;
	const label = fill(context, values, spec.label ?? "", `${where} label`);
	if (spec.type === "pick") {
		const options = spec.options.map((option, i) => fill(context, values, option, `${where} option ${i + 1}`));
		if (options.length < 2) fail(context, `${where}: a pick part needs at least two options`);
		if (new Set(options).size !== options.length) fail(context, `${where}: two options read the same on retake ${context.retake}`);
		if (!Number.isInteger(spec.answer) || spec.answer < 0 || spec.answer >= options.length) fail(context, `${where}: answer ${spec.answer} is not one of its ${options.length} options (they count from 0)`);
		if (!spec.shuffle) return {
			type: "pick",
			label,
			options,
			answer: spec.answer
		};
		const order = shuffledOrder(context, index, options.length);
		return {
			type: "pick",
			label,
			options: order.map((i) => options[i]),
			answer: order.indexOf(spec.answer)
		};
	}
	if (spec.type === "click") {
		const answer = clickAnswer$1(context, values, spec, where);
		return {
			type: "click",
			label,
			mode: spec.mode,
			answer
		};
	}
	return fail(context, `${where}: there is no part type "${spec.type}"`);
}
// src/content/kinds.ts
/**
The task kinds: for each, the answer parts, the values its text can use,
the worked solution, and what to show on the tree before and after.
Every answer comes from the engine. Internal to the content module.
*/
function step(tree, highlight, text) {
	return {
		tree,
		highlight,
		text
	};
}
function dimOutside(tree, key) {
	if (key === void 0) return void 0;
	const dimmed = outside(tree, key);
	return dimmed.length === 0 ? void 0 : { dimmed };
}
function searchValues(key, result) {
	const values = {
		key,
		path: result.path,
		visits: result.path.length,
		result: result.found ? "found" : "not found"
	};
	if (result.endAt !== null && result.side !== null) {
		values.endAt = result.endAt;
		values.side = result.side;
	}
	return values;
}
function needTree(context) {
	if (context.tree === null) fail(context, `a "${context.item.ask.kind}" task needs a tree that is not empty`);
	return context.tree;
}
var CASE_INDEX = {
	leaf: 0,
	one: 1,
	two: 2
};
var CASE_NAMES = {
	leaf: "Case 1, a leaf",
	one: "Case 2, one child",
	two: "Case 3, two children"
};
var ORDER_NAMES = {
	pre: "pre-order",
	in: "in-order",
	post: "post-order"
};
function rootAndLeaves(context, ask) {
	const tree = needTree(context);
	const root = tree.key;
	const leafKeys = leaves(tree);
	const h = height(tree);
	const tags = { [root]: "root" };
	for (const key of leafKeys) tags[key] = "leaf";
	const parts = [{
		type: "click",
		label: "",
		mode: "set",
		answer: [root, ...leafKeys]
	}];
	const solution = [step(tree, { tags: { [root]: "root" } }, `${root} has no parent: it is the root.`), step(tree, { tags }, leafKeys.length === 1 ? `${leafKeys[0]} has no children: it is a leaf.` : `${listInWords(leafKeys)} have no children: they are leaves.`)];
	if (ask.withHeight) {
		parts.push(numberPick("Height of the tree", h));
		solution.push(step(tree, { edges: pathEdges(longestPath(tree)) }, `The longest path from the root down to a leaf has ${plural(h, "edge")}, so the height is ${h}.`));
	}
	return {
		values: {
			root,
			leaves: leafKeys,
			height: h
		},
		parts,
		solution
	};
}
function depthHeight(context, ask) {
	const tree = needTree(context);
	if (ask.depthOf === void 0 && ask.heightOf === void 0) fail(context, "a depthHeight task needs depthOf, heightOf or both");
	const values = {};
	const parts = [];
	const solution = [];
	if (ask.depthOf !== void 0) {
		const key = shiftNode(context, ask.depthOf, "depthOf");
		context.depthOf = key;
		const d = depth(tree, key);
		const path = pathTo(tree, key) ?? [];
		values.depth = d;
		parts.push(numberPick(`Depth of ${key}`, d));
		solution.push(step(tree, {
			visited: path,
			edges: pathEdges(path)
		}, `From the root to ${key}: ${plural(d, "edge")}, so the depth is ${d}.`));
	}
	if (ask.heightOf !== void 0) {
		const key = shiftNode(context, ask.heightOf, "heightOf");
		context.heightOf = key;
		const below = subtree(tree, key);
		const h = height(below);
		const isRoot = key === tree.key;
		values.height = h;
		parts.push(numberPick(isRoot ? "Height of the tree" : `Height of the subtree rooted at ${key}`, h));
		solution.push(step(tree, {
			...dimOutside(tree, key),
			edges: pathEdges(longestPath(below))
		}, `From ${isRoot ? "the root" : key} down to a leaf: ${plural(h, "edge")} at most, so the height is ${h}.`));
	}
	return {
		values,
		parts,
		solution
	};
}
function validity(context) {
	const tree = needTree(context);
	const offenders = findOffenders(tree);
	const valid = offenders.length === 0;
	const values = {
		valid: valid ? "valid" : "invalid",
		offenders
	};
	const parts = [{
		type: "pick",
		label: "",
		options: ["Valid", "Invalid"],
		answer: valid ? 0 : 1
	}];
	if (valid) return {
		values,
		parts,
		solution: []
	};
	if (offenders.length === 1) {
		values.offender = offenders[0];
		parts.push({
			type: "click",
			label: "The node that breaks the rule",
			mode: "one",
			answer: offenders[0]
		});
	} else parts.push({
		type: "click",
		label: "The nodes that break the rule",
		mode: "set",
		answer: offenders
	});
	return {
		values,
		parts,
		solution: [],
		result: {
			tree,
			highlight: { offender: offenders[0] }
		}
	};
}
function searchPathTask(context, ask) {
	const key = shiftKey(context, ask.key, "the task key");
	context.key = key;
	const result = search(context.tree, key);
	return {
		values: searchValues(key, result),
		parts: [{
			type: "click",
			label: "Path",
			mode: "path",
			answer: [...result.path]
		}, {
			type: "pick",
			label: "Result",
			options: ["Found", "Not found"],
			answer: result.found ? 0 : 1
		}],
		solution: searchSteps(context.tree, key)
	};
}
function searchEnd(context, ask) {
	const key = shiftKey(context, ask.key, "the task key");
	context.key = key;
	const result = search(context.tree, key);
	if (result.found || result.endAt === null) fail(context, `searchEnd needs a key that is not in the tree, but ${ask.key} is in it`);
	return {
		values: searchValues(key, result),
		parts: [{
			type: "click",
			label: "The node",
			mode: "one",
			answer: result.endAt
		}, {
			type: "pick",
			label: "Which side of it is empty?",
			options: ["Left", "Right"],
			answer: result.side === "left" ? 0 : 1
		}],
		solution: searchSteps(context.tree, key)
	};
}
function maxVisits(context) {
	const h = height(context.tree);
	const most = h + 1;
	const n = size(context.tree);
	const options = [.../* @__PURE__ */ new Set([
		h,
		most,
		h + 2,
		n
	])].sort((a, b) => a - b);
	return {
		values: {
			height: h,
			most,
			size: n
		},
		parts: [{
			type: "pick",
			label: "",
			options: options.map(String),
			answer: options.indexOf(most)
		}],
		solution: []
	};
}
function insertSlot(context, ask) {
	const tree = needTree(context);
	const key = shiftKey(context, ask.key, "the task key");
	context.key = key;
	const result = search(tree, key);
	if (result.found) fail(context, `insertSlot needs a key that is not in the tree, but ${ask.key} is in it`);
	const slot = {
		parent: result.endAt,
		side: result.side
	};
	return {
		values: searchValues(key, result),
		parts: [{
			type: "place",
			label: "",
			keys: [key],
			answer: [slot]
		}],
		solution: insertSteps(tree, key),
		result: {
			tree: insert(tree, key).tree,
			highlight: {
				found: key,
				edges: pathEdges([...result.path, key])
			}
		}
	};
}
function buildTask(context, ask) {
	if (!Array.isArray(ask.keys) || ask.keys.length === 0) fail(context, "a build task needs a list of keys");
	const keys = ask.keys.map((key) => shiftKey(context, key, "build keys"));
	let tree = context.tree;
	const slots = [];
	const solution = [];
	for (const [i, key] of keys.entries()) {
		const result = search(tree, key);
		if (result.found) fail(context, `build key ${ask.keys[i]} is already in the tree by then`);
		slots.push({
			parent: result.endAt,
			side: result.side
		});
		if (context.tree !== null) solution.push(...insertSteps(tree, key));
		tree = insert(tree, key).tree;
	}
	return {
		values: {
			keys,
			root: tree.key
		},
		parts: [{
			type: "place",
			label: "",
			keys,
			answer: slots
		}],
		solution: context.tree === null ? buildSteps(keys) : solution,
		result: {
			tree,
			highlight: {}
		}
	};
}
function minMax(context, ask) {
	const tree = needTree(context);
	const find = ask.find;
	if (!Array.isArray(find) || find.length === 0 || new Set(find).size !== find.length || !find.every((which) => which === "min" || which === "max")) fail(context, "a minMax task needs find: [\"min\"], [\"max\"] or both, each once");
	const from = ask.from === void 0 ? void 0 : shiftNode(context, ask.from, "from");
	context.from = from;
	context.find = find;
	const start = from === void 0 ? tree : subtree(tree, from);
	const of = from === void 0 ? "" : ` of the subtree rooted at ${from}`;
	const values = from === void 0 ? {} : { from };
	return {
		values,
		parts: find.map((which) => {
			const answer = (which === "min" ? minPath(start) : maxPath(start)).at(-1);
			values[which] = answer;
			return {
				type: "click",
				label: `${which === "min" ? "Minimum" : "Maximum"}${of}`,
				mode: "one",
				answer
			};
		}),
		solution: find.flatMap((which) => extremeSteps(start, which)),
		...from === void 0 ? {} : { base: dimOutside(tree, from) }
	};
}
function traversal(context, ask) {
	const tree = needTree(context);
	if (!(ask.order in ORDER_NAMES)) fail(context, `a traversal order is "pre", "in" or "post", not "${ask.order}"`);
	const from = ask.from === void 0 ? void 0 : shiftNode(context, ask.from, "from");
	context.from = from;
	context.order = ask.order;
	const start = from === void 0 ? tree : subtree(tree, from);
	const sequence = traverse(start, ask.order);
	let cards = shuffledOrder(context, 0, sequence.length).map((i) => sequence[i]);
	if (sequence.length > 1 && cards.every((key, i) => key === sequence[i])) cards = [...cards.slice(1), cards[0]];
	return {
		values: {
			sequence,
			orderName: ORDER_NAMES[ask.order]
		},
		parts: [{
			type: "order",
			label: "",
			cards,
			answer: sequence
		}],
		solution: traversalSteps(start, ask.order),
		...from === void 0 ? {} : { base: dimOutside(tree, from) }
	};
}
function deleteTask(context, ask) {
	const tree = needTree(context);
	const key = shiftNode(context, ask.key, "the task key");
	context.key = key;
	const removed = remove(tree, key);
	const deleteCase = removed.case;
	const node = subtree(tree, key);
	const values = {
		key,
		case: deleteCase,
		caseName: CASE_NAMES[deleteCase]
	};
	let found;
	if (deleteCase === "one") found = values.child = (node.left ?? node.right)?.key;
	if (deleteCase === "two") found = values.successor = removed.successor;
	const parts = [{
		type: "pick",
		label: "Which case is this?",
		options: [
			"Leaf",
			"One child",
			"Two children"
		],
		answer: CASE_INDEX[deleteCase]
	}];
	if (ask.successor) {
		if (deleteCase !== "two") fail(context, `a successor is only asked for when the node has two children, but ${ask.key} does not`);
		parts.push({
			type: "click",
			label: "Click the in-order successor",
			mode: "one",
			answer: removed.successor
		});
	}
	if (typeof ask.result !== "object" || ask.result === null || !Array.isArray(ask.result.options)) fail(context, "a delete task needs result: { options, answer } describing the tree afterwards");
	parts.push(buildPart(context, values, {
		type: "pick",
		label: "What does the tree look like afterwards?",
		options: ask.result.options,
		answer: ask.result.answer,
		shuffle: true
	}, parts.length));
	return {
		values,
		parts,
		solution: deleteSteps(tree, key),
		base: { tags: { [key]: "delete" } },
		result: {
			tree: removed.tree,
			highlight: found === void 0 ? {} : { found }
		},
		deleteCase
	};
}
function successorTask(context, ask) {
	const tree = needTree(context);
	const key = shiftNode(context, ask.key, "the task key");
	context.key = key;
	const right = subtree(tree, key).right;
	if (right === null) fail(context, `${ask.key} has no right subtree, so its successor is not the minimum of a right subtree`);
	const next = successor(tree, key);
	return {
		values: {
			key,
			successor: next,
			rightChild: right.key
		},
		parts: [{
			type: "click",
			label: "The in-order successor",
			mode: "one",
			answer: next
		}],
		solution: extremeSteps(right, "min")
	};
}
function work(context) {
	const ask = context.item.ask;
	switch (ask.kind) {
		case "rootAndLeaves": return rootAndLeaves(context, ask);
		case "depthHeight": return depthHeight(context, ask);
		case "validity": return validity(context);
		case "searchPath": return searchPathTask(context, ask);
		case "searchEnd": return searchEnd(context, ask);
		case "maxVisits": return maxVisits(context);
		case "insertSlot": return insertSlot(context, ask);
		case "build": return buildTask(context, ask);
		case "minMax": return minMax(context, ask);
		case "traversal": return traversal(context, ask);
		case "delete": return deleteTask(context, ask);
		case "successor": return successorTask(context, ask);
		case "fixed": return {
			values: {},
			parts: null,
			solution: []
		};
		default: return fail(context, `there is no kind of task "${ask.kind}"`);
	}
}
// src/content/resolve.ts
/**
The resolver: turns a lesson item from the JSON into a ready-to-show
question for one retake. It builds the tree with that retake's keys, asks
the engine for every answer, fills the text, works out the highlights and
attaches the worked solution.

Every key written in an item (in text as `{50}`, in a task, a tree
reference, a written answer or a written highlight) is a retake-0 key and
is shifted here. Values the resolver works out, such as `path`, are already
in the retake's keys.

The pieces live in: `context.ts` (shared helpers), `kinds.ts` (one function
per task kind), `parts.ts` (written answer parts) and `highlights.ts`
(presets and written highlights).
*/
function buildTree(item, retake, offset) {
	if (item.tree === void 0) {
		if (item.ask.kind !== "build") fail({ item }, `a "${item.ask.kind}" task needs a tree`);
		return null;
	}
	return treeFromRef({ item }, item.tree, retake, offset);
}
function resolveItem(item, lesson, retake = 0) {
	const offset = offsetFor(retake);
	const tree = buildTree(item, retake, offset);
	const context = {
		item,
		retake,
		offset,
		tree,
		keys: new Set(preorder(tree))
	};
	const worked = work(context);
	const { values } = worked;
	let parts;
	if (item.parts === void 0) {
		if (worked.parts === null) fail(context, `a "${item.ask.kind}" task needs its parts written in the item`);
		parts = worked.parts;
	} else parts = item.parts.map((spec, index) => buildPart(context, values, spec, index));
	if (parts.length < 1 || parts.length > 3) fail(context, `a question has one to three parts, not ${parts.length}`);
	const hints = item.hints.map((hint, index) => {
		const where = `hint ${index + 1}`;
		const text = fill(context, values, hint.text, where);
		return hint.highlight === void 0 ? { text } : {
			text,
			highlight: anyHighlight(context, values, hint.highlight, where)
		};
	});
	const base = item.base === void 0 ? worked.base : anyHighlight(context, values, item.base, "base");
	const optional = (name) => item[name] === void 0 ? {} : { [name]: fill(context, values, item[name], name) };
	return deepFreeze$1({
		id: item.id,
		lesson,
		outcome: item.outcome,
		retake,
		...optional("intro"),
		prompt: fill(context, values, item.prompt, "prompt"),
		tree,
		...base === void 0 ? {} : { base },
		parts,
		hints,
		explanation: fill(context, values, item.explanation, "explanation"),
		solution: worked.solution,
		...worked.result === void 0 ? {} : { result: worked.result },
		...worked.deleteCase === void 0 ? {} : { deleteCase: worked.deleteCase },
		...optional("misconception"),
		...optional("bridge")
	});
}
// src/content/validateLesson.ts
/**
* Checking a lesson file's structure when it loads, so a typo in the JSON
* fails a test with the exact place ("lesson3.json: activity.items[2].ask.key
* must be a whole number") instead of breaking a screen.
*
* This checks shape only. Whether the content is right (trees exist, keys are
* in them, answers work on every retake) is checked by `resolveLesson` and
* `resolveItem`, which the content tests run on every lesson.
*/
var OUTCOMES = [
	"LO1",
	"LO2",
	"LO3",
	"LO4",
	"LO5",
	"LO6"
];
var ORDERS = literal("pre", "in", "post");
var SIDES = literal("left", "right");
var PRESETS = [
	"path",
	"otherHalf",
	"emptySpot",
	"longestPath",
	"leaves",
	"depthHeight",
	"extremePaths",
	"outsideSubtree",
	"dots",
	"children",
	"rightSubtree"
];
var name = (value, path) => {
	if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) bad(path, "must be a tree name such as \"T\"");
	return value;
};
var treeRef = (value, path) => typeof value === "string" ? name(value, path) : object({ from: name }, {
	insert: intList({ min: 1 }),
	delete: intList({ min: 1 })
})(value, path);
/** A written highlight. `label` checks the text in tags and labels: plain for stages, placeholders allowed in items. */
function highlight(label) {
	return object({}, {
		visited: intList(),
		current: int,
		found: int,
		offender: int,
		outlined: intList(),
		dimmed: intList(),
		edges: list(tuple(int, int)),
		tags: keyedByNode(label),
		slot: object({
			parent: int,
			side: SIDES
		}),
		dots: literal("pre", "in", "post", "all"),
		marker: object({
			key: int,
			position: ORDERS
		}),
		output: intList(),
		relabel: keyedByNode(int),
		ghost: int,
		slotLabel: label,
		edgeLabels: list(tuple(int, int, label))
	});
}
var presetOr = (written) => (value, path) => typeof value === "string" ? literal(...PRESETS)(value, path) : written(value, path);
var choiceOption = object({
	text: plainText,
	reply: plainText
});
var deleteResult = refine(object({
	options: list(text, { min: 2 }),
	answer: int
}), answerInRange);
var ask = kinded("kind", {
	rootAndLeaves: object({}, { withHeight: bool }),
	depthHeight: object({}, {
		depthOf: int,
		heightOf: int
	}),
	validity: object({}),
	searchPath: object({ key: int }),
	searchEnd: object({ key: int }),
	maxVisits: object({}),
	insertSlot: object({ key: int }),
	build: object({ keys: intList({ min: 1 }) }),
	minMax: object({ find: list(literal("min", "max"), {
		min: 1,
		max: 2
	}) }, { from: int }),
	traversal: object({ order: ORDERS }, { from: int }),
	delete: object({
		key: int,
		result: deleteResult
	}, { successor: bool }),
	successor: object({ key: int }),
	fixed: object({})
});
var clickAnswer = (value, path) => {
	if (typeof value === "string") return text(value, path);
	if (Array.isArray(value)) return intList({ min: 1 })(value, path);
	return int(value, path);
};
var part = kinded("type", {
	pick: refine(object({
		options: list(text, { min: 2 }),
		answer: int
	}, {
		label: text,
		shuffle: bool
	}), answerInRange),
	click: object({
		mode: literal("one", "set", "path"),
		answer: clickAnswer
	}, { label: text })
});
var itemHighlight = presetOr(highlight(text));
/** One activity item. Exported for the final test, whose items have the same shape. */
var item = object({
	id: (value, path) => {
		if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(value)) bad(path, "must be lowercase letters, digits and dashes, such as \"l2-search-20\"");
		return value;
	},
	outcome: literal(...OUTCOMES),
	ask,
	prompt: text,
	hints: list(object({ text }, { highlight: itemHighlight }), { max: 2 }),
	explanation: text
}, {
	tree: treeRef,
	base: itemHighlight,
	intro: text,
	parts: list(part, {
		min: 1,
		max: 3
	}),
	misconception: text,
	bridge: text
});
var diagram = object({ tree: treeRef }, { highlight: highlight(plainText) });
var hook$5 = object({
	goal: plainText,
	scenario: object({
		title: plainText,
		text: plainText
	}, {
		recall: plainText,
		reveal: plainText
	}),
	warmUp: refine(object({
		question: plainText,
		options: list(choiceOption, { min: 2 }),
		answer: int
	}, { tree: treeRef }), answerInRange)
}, { bridge: plainText });
var deleteTryResult = (value, path) => {
	if (value === null || value === "delete") return value;
	return object({ shape })(value, path);
};
var explore$5 = kinded("kind", {
	relatives: object({
		tree: treeRef,
		need: positiveInt
	}),
	pickTree: refine(object({
		prompt: plainText,
		trees: list(object({
			label: plainText,
			tree: treeRef
		}), { min: 2 }),
		answer: int,
		reveal: plainText
	}), (value, path) => answerInRange({
		options: value.trees,
		answer: value.answer
	}, path)),
	freeSearch: object({
		tree: treeRef,
		key: int
	}),
	slotProbe: object({
		tree: treeRef,
		key: int
	}),
	walk: object({ tree: treeRef }),
	orderGuess: object({
		tree: treeRef,
		order: ORDERS
	}),
	deleteTry: object({ cases: list(object({
		label: plainText,
		tree: treeRef,
		key: int,
		options: list(object({
			text: plainText,
			result: deleteTryResult
		}), { min: 2 })
	}, { note: plainText }), { min: 1 }) }),
	reflect: refine(object({
		prompt: plainText,
		options: list(choiceOption, { min: 2 }),
		answer: nullable(int)
	}), answerInRange)
});
var PSEUDOCODE_NAMES = literal("search", "insert", "traverse", "delete");
var explainPage = object({ title: plainText }, {
	terms: list(object({
		group: plainText,
		items: list(object({
			term: plainText,
			meaning: plainText
		}), { min: 1 })
	}), { min: 1 }),
	steps: list(plainText, { min: 1 }),
	note: plainText,
	diagram,
	caption: plainText,
	pseudocode: PSEUDOCODE_NAMES
});
var BUILDERS = {
	search: object({
		tree: treeRef,
		key: int
	}),
	insert: object({
		tree: treeRef,
		key: int
	}),
	build: intList({ min: 1 }),
	extreme: object({
		tree: treeRef,
		which: literal("min", "max")
	}, { from: int }),
	traversal: object({
		tree: treeRef,
		order: ORDERS
	}, { from: int }),
	walk: object({ tree: treeRef }),
	delete: object({
		tree: treeRef,
		key: int
	})
};
/** One engine builder (`{ "search": { ... } }`), or a written step (`{ "tree", "text", "highlight" }`). */
var stepSpec = (value, path) => {
	if (typeof value === "object" && value !== null && "text" in value) return object({
		tree: treeRef,
		text: plainText
	}, { highlight: highlight(plainText) })(value, path);
	const fields = typeof value === "object" && value !== null ? Object.keys(value) : [];
	const builder = fields.length === 1 ? fields[0] : "";
	const check = Object.hasOwn(BUILDERS, builder) ? BUILDERS[builder] : void 0;
	if (check === void 0) bad(path, `must have exactly one of ${Object.keys(BUILDERS).join(", ")}, or be a written step with tree and text`);
	return { [builder]: check(value[builder], `${path}.${builder}`) };
};
var workedExample = object({
	label: plainText,
	steps: list(stepSpec, { min: 1 })
}, {
	deleteCase: literal("leaf", "one", "two"),
	pseudocode: PSEUDOCODE_NAMES
});
var nodeFact = (value, path) => {
	if (value === "root" || value === "leaves") return value;
	if (Array.isArray(value)) return intList({ min: 1 })(value, path);
	if (typeof value === "object" && value !== null) return "parentOf" in value ? object({ parentOf: int })(value, path) : object({ successorOf: int })(value, path);
	return bad(path, "must be \"root\", \"leaves\", { \"parentOf\": key }, { \"successorOf\": key } or a list of keys");
};
var guidedStep = kinded("ask", {
	node: object({
		prompt: plainText,
		answer: nodeFact,
		right: plainText,
		wrong: plainText
	}, {
		tag: plainText,
		highlight: highlight(plainText)
	}),
	choice: refine(object({
		prompt: plainText,
		options: list(plainText, { min: 2 }),
		answer: int,
		right: plainText,
		wrong: plainText
	}, {
		highlight: highlight(plainText),
		showRange: bool,
		after: diagram
	}), answerInRange)
});
var tryIt$5 = kinded("kind", {
	search: object({
		title: plainText,
		tree: treeRef,
		key: int
	}),
	insert: object({
		title: plainText,
		tree: treeRef,
		key: int
	}),
	traversal: object({
		title: plainText,
		tree: treeRef,
		order: ORDERS
	}, { from: int }),
	guided: object({
		title: plainText,
		tree: treeRef,
		steps: list(guidedStep, { min: 1 })
	})
});
var lesson$5 = object({
	lesson: literal(1, 2, 3, 4, 5),
	title: plainText,
	short: plainText,
	minutes: positiveInt,
	outcomes: refine(list(literal(...OUTCOMES), { min: 1 }), (value, path) => {
		if (new Set(value).size !== value.length) bad(path, "must not repeat an outcome");
	}),
	summary: plainText,
	hook: hook$5,
	explore: list(explore$5, { min: 1 }),
	explain: object({ pages: list(explainPage, { min: 1 }) }),
	worked: object({ examples: list(workedExample, { min: 1 }) }),
	tryIt: tryIt$5,
	activity: object({
		title: plainText,
		items: list(item, { min: 1 })
	})
});
/** Check a lesson file's structure, throwing an Error naming the first problem and where it is. */
function validateLesson(raw, file = "lesson") {
	try {
		const spec = lesson$5(raw, "");
		const ids = /* @__PURE__ */ new Set();
		spec.activity.items.forEach((entry, i) => {
			if (ids.has(entry.id)) bad(`activity.items[${i}].id`, `repeats the id "${entry.id}"`);
			ids.add(entry.id);
			if (!spec.outcomes.includes(entry.outcome)) bad(`activity.items[${i}].outcome`, `is ${entry.outcome}, which is not one of this lesson's outcomes`);
		});
		return deepFreeze$1(spec);
	} catch (error) {
		if (error instanceof ShapeError) throw new Error(`${file}: ${error.message}`);
		throw error;
	}
}
// src/content/lessons.ts
var FILES = {
	1: {
		lesson: 1,
		title: "Trees and the BST rule",
		short: "Trees",
		minutes: 15,
		outcomes: ["LO1", "LO2"],
		summary: "Name the parts of a tree, and tell a valid BST from a tree that only looks like one.",
		hook: {
			"goal": "Name the parts of a tree, and use the BST rule to decide whether a tree is a binary search tree.",
			"scenario": {
				"title": "Folders inside folders",
				"text": "On your laptop a folder can hold other folders, and those can hold more folders. You have already used a tree.",
				"recall": "A linked-list node has one \"next\" reference. What if a node had two?"
			},
			"warmUp": {
				"question": "A linked-list node points to one next node. If every node could point to two nodes, what shape could you build?",
				"options": [
					{
						"text": "Only a longer chain",
						"reply": "A chain only needs one reference. With two, a node can split into two branches."
					},
					{
						"text": "A branching shape, like folders inside folders",
						"reply": "Yes. Each node can branch into a left and a right part. That shape is a binary tree."
					},
					{
						"text": "A list that is sorted automatically",
						"reply": "Two references do not sort anything by themselves. The shape is what changes: each node can branch."
					}
				],
				"answer": 1
			},
			"bridge": "You also met binary search, where one comparison throws away half of the values. Keep that in mind: the BST rule is what lets a tree do the same."
		},
		explore: [
			{
				"kind": "relatives",
				"tree": "T",
				"need": 3
			},
			{
				"kind": "pickTree",
				"prompt": "Predict: in which tree can a search always decide to go left or right at each node?",
				"trees": [
					{
						"label": "A",
						"tree": "T"
					},
					{
						"label": "B",
						"tree": "X"
					},
					{
						"label": "C",
						"tree": "SWAP"
					}
				],
				"answer": 0,
				"reveal": "Tree A. In B, 40 sits in 50's right subtree although it is smaller than 50. In C, the larger key is on the left."
			},
			{
				"kind": "reflect",
				"prompt": "What rule did the good tree follow?",
				"options": [
					{
						"text": "Smaller keys on the left and larger keys on the right, at every node",
						"reply": "That is the BST rule, which you will see written out next."
					},
					{
						"text": "Every node has exactly two children",
						"reply": "Not quite: in tree A some nodes have no children. Look at where the smaller keys sit."
					},
					{
						"text": "The largest key is at the root",
						"reply": "Not quite: 50 is at the root of A, and 80 is larger. Look at where the smaller keys sit."
					}
				],
				"answer": 0
			}
		],
		explain: { "pages": [{
			"title": "Tree words",
			"terms": [
				{
					"group": "Shape words",
					"items": [
						{
							"term": "Node",
							"meaning": "one item in the tree, holding a key"
						},
						{
							"term": "Edge",
							"meaning": "the link between two nodes"
						},
						{
							"term": "Root",
							"meaning": "the top node; it has no parent"
						},
						{
							"term": "Leaf",
							"meaning": "a node with no children"
						}
					]
				},
				{
					"group": "Family words",
					"items": [
						{
							"term": "Parent / child",
							"meaning": "a node and the node directly below it"
						},
						{
							"term": "Sibling",
							"meaning": "two children of the same parent"
						},
						{
							"term": "Subtree",
							"meaning": "a node and everything below it"
						}
					]
				},
				{
					"group": "Measure words",
					"items": [{
						"term": "Depth",
						"meaning": "number of edges from the root to the node"
					}, {
						"term": "Height",
						"meaning": "number of edges on the longest path down to a leaf"
					}]
				}
			],
			"note": "Binary means each node has at most two children, called left and right.",
			"diagram": {
				"tree": "T",
				"highlight": {
					"tags": {
						"50": "root",
						"20": "leaf",
						"80": "leaf"
					},
					"edges": [[50, 30], [30, 40]]
				}
			},
			"caption": "Depth of 40 is 2 (two highlighted edges). Tree T has height 2."
		}, {
			"title": "The BST rule",
			"steps": [
				"For every node, every key in its left subtree is smaller than the node.",
				"Every key in its right subtree is larger than the node.",
				"The rule covers the whole subtree, not just the children.",
				"An empty tree is a BST.",
				"Duplicate keys are not allowed."
			],
			"diagram": {
				"tree": "T",
				"highlight": { "edgeLabels": [[
					50,
					30,
					"all smaller"
				], [
					50,
					70,
					"all larger"
				]] }
			},
			"caption": "Everything under 30 is smaller than 50. Everything under 70 is larger than 50."
		}] },
		worked: { "examples": [{
			"label": "Label tree T",
			"steps": [
				{
					"tree": "T",
					"highlight": { "tags": { "50": "root" } },
					"text": "50 has no parent, so 50 is the root."
				},
				{
					"tree": "T",
					"highlight": { "tags": {
						"50": "root",
						"20": "leaf",
						"40": "leaf",
						"60": "leaf",
						"80": "leaf"
					} },
					"text": "20, 40, 60 and 80 have no children, so they are leaves."
				},
				{
					"tree": "T",
					"highlight": {
						"visited": [
							50,
							30,
							40
						],
						"edges": [[50, 30], [30, 40]]
					},
					"text": "The depth of 40 is 2: there are two edges from the root to 40."
				},
				{
					"tree": "T",
					"highlight": {
						"dimmed": [
							50,
							70,
							60,
							80
						],
						"current": 30,
						"edges": [[30, 40]]
					},
					"text": "The subtree rooted at 30 has height 1: the longest path down from 30 has one edge."
				},
				{
					"tree": "T",
					"highlight": { "edges": [[50, 30], [30, 20]] },
					"text": "Tree T has height 2: the longest path from the root to a leaf has two edges."
				}
			]
		}, {
			"label": "Check tree X",
			"steps": [
				{
					"tree": "X",
					"highlight": {
						"current": 50,
						"outlined": [30]
					},
					"text": "Check 50. Its left subtree holds 30, which is smaller than 50. That side is fine."
				},
				{
					"tree": "X",
					"highlight": {
						"current": 50,
						"outlined": [70, 40]
					},
					"text": "Its right subtree holds 70 and 40. Every key there must be larger than 50."
				},
				{
					"tree": "X",
					"highlight": {
						"offender": 40,
						"outlined": [50]
					},
					"text": "40 is smaller than 50 but sits in 50's right subtree. The rule is broken at 40."
				},
				{
					"tree": "X",
					"highlight": { "offender": 40 },
					"text": "Next to its parent 70, 40 looks fine. That is why checking only parent and child is not enough. X is not a BST."
				}
			]
		}] },
		tryIt: {
			"kind": "guided",
			"title": "Label tree T",
			"tree": "T",
			"steps": [
				{
					"ask": "node",
					"prompt": "Put the label \"root\" on the tree: click the root.",
					"answer": "root",
					"tag": "root",
					"right": "50 has no parent, so it is the root.",
					"wrong": "The root is the one node with no parent."
				},
				{
					"ask": "node",
					"prompt": "Now label a leaf: click any leaf.",
					"answer": "leaves",
					"tag": "leaf",
					"right": "Correct: that node has no children.",
					"wrong": "A leaf has no children. Look along the bottom row."
				},
				{
					"ask": "node",
					"prompt": "Label the parent of 40.",
					"answer": { "parentOf": 40 },
					"tag": "parent",
					"right": "30 is directly above 40, so it is 40's parent.",
					"wrong": "The parent is the node directly above 40."
				},
				{
					"ask": "choice",
					"prompt": "There is an empty spot on the right of 60. Which key could go there?",
					"options": [
						"45",
						"65",
						"75"
					],
					"answer": 1,
					"highlight": { "slot": {
						"parent": 60,
						"side": "right"
					} },
					"showRange": true,
					"right": "65 fits: it is larger than 60 and smaller than 70.",
					"wrong": "Check every ancestor: the spot is in 50's right subtree, in 70's left subtree, and on 60's right."
				}
			]
		},
		activity: {
			"title": "Spot the BST",
			"items": [
				{
					"id": "l1-root-leaves",
					"outcome": "LO1",
					"tree": "T",
					"ask": { "kind": "rootAndLeaves" },
					"prompt": "Click the root and every leaf of this tree.",
					"hints": [{ "text": "The root has no parent. A leaf has no children. How many of each can you find?" }, {
						"text": "The nodes with no children are now outlined. Remember the root as well.",
						"highlight": "leaves"
					}],
					"explanation": "The root is {root}. The leaves are {leaves}, because they have no children."
				},
				{
					"id": "l1-depth-height",
					"outcome": "LO1",
					"tree": "T",
					"ask": {
						"kind": "depthHeight",
						"depthOf": 40,
						"heightOf": 30
					},
					"prompt": "Give the depth of {40} and the height of the subtree rooted at {30}.",
					"hints": [{ "text": "Depth counts edges from the root. Height counts edges on the longest path down to a leaf." }, {
						"text": "The edges from the root to {40} are highlighted, and the subtree rooted at {30} is outlined. Count edges, not nodes.",
						"highlight": "depthHeight"
					}],
					"explanation": "The depth of {40} is 2: two edges from the root. The subtree rooted at {30} has height 1: one edge down to a leaf.",
					"misconception": "Mixing up depth and height, or counting nodes instead of edges."
				},
				{
					"id": "l1-valid-t",
					"outcome": "LO2",
					"tree": "T",
					"ask": { "kind": "validity" },
					"prompt": "Is this tree a valid BST?",
					"hints": [{ "text": "For every node: are all keys on its left smaller, and all keys on its right larger?" }, {
						"text": "The left subtree of the root is outlined. Is every key there smaller than {50}?",
						"highlight": { "outlined": [
							30,
							20,
							40
						] }
					}],
					"explanation": "Valid. At every node, every key in the left subtree is smaller and every key in the right subtree is larger."
				},
				{
					"id": "l1-invalid-x",
					"outcome": "LO2",
					"tree": "X",
					"ask": { "kind": "validity" },
					"prompt": "Is this tree a valid BST? If not, click the node that breaks the rule.",
					"hints": [{ "text": "Compare each node with every ancestor, not only with its parent." }, {
						"text": "Everything in {50}'s right subtree (outlined) must be larger than {50}. Which node does not fit?",
						"highlight": { "outlined": [70, 40] }
					}],
					"explanation": "Invalid. {40} is in the right subtree of {50} but is smaller than {50}, even though it sits correctly under its parent {70}.",
					"misconception": "Checking a node only against its parent."
				},
				{
					"id": "l1-invalid-55",
					"outcome": "LO2",
					"tree": "T55",
					"ask": { "kind": "validity" },
					"prompt": "Is this tree a valid BST? If not, click the node that breaks the rule.",
					"hints": [{ "text": "Compare each node with every ancestor, not only with its parent." }, {
						"text": "Every key in {50}'s left subtree must be smaller than {50}, so the spot right of {30} only allows keys from {31} to {49}.",
						"highlight": {
							"outlined": [30, 55],
							"tags": { "55": "allowed: {31} to {49}" }
						}
					}],
					"explanation": "Invalid. {55} is larger than {50} but sits on {50}'s left side.",
					"misconception": "Checking a node only against its parent."
				},
				{
					"id": "l1-parent-enough",
					"outcome": "LO2",
					"tree": "T55",
					"ask": { "kind": "fixed" },
					"prompt": "True or false: checking each parent against its own children is enough to know a tree is a BST.",
					"parts": [{
						"type": "pick",
						"options": ["True", "False"],
						"answer": 1
					}],
					"hints": [{ "text": "Think back to tree X. Did every parent-child pair look fine?" }, {
						"text": "Here {55} is fine next to its parent {30}. Now compare it with the root.",
						"highlight": { "outlined": [55, 50] }
					}],
					"explanation": "False. A key must be on the correct side of every ancestor, not only its parent.",
					"misconception": "Checking a node only against its parent."
				}
			]
		}
	},
	2: {
		lesson: 2,
		title: "Search, the core algorithm",
		short: "Search",
		minutes: 12,
		outcomes: ["LO3"],
		summary: "Trace a search for a key and say whether it is found.",
		hook: {
			"goal": "Trace a search in a BST, listing the nodes visited, and say whether the key is found.",
			"scenario": {
				"title": "A guessing game",
				"text": "I am thinking of a number from 1 to 100. After each guess I only say \"higher\" or \"lower\".",
				"reveal": "Guessing 50 first is smartest: whatever I answer, half of the numbers are ruled out with one guess."
			},
			"warmUp": {
				"question": "In binary search on a sorted array, what does one comparison let you do?",
				"options": [
					{
						"text": "Check every value in turn",
						"reply": "That is a linear search. Binary search does better with each comparison."
					},
					{
						"text": "Discard half of the remaining values",
						"reply": "Yes. One comparison rules out half of what is left. A BST search works the same way."
					},
					{
						"text": "Sort the array",
						"reply": "Binary search needs an array that is already sorted; it does not sort it."
					},
					{
						"text": "Jump straight to the largest value",
						"reply": "Binary search starts in the middle, not at the largest value."
					}
				],
				"answer": 1
			}
		},
		explore: [{
			"kind": "freeSearch",
			"tree": "T",
			"key": 60
		}, {
			"kind": "reflect",
			"prompt": "What did you do at each node?",
			"options": [
				{
					"text": "Compared 60 with the node, then went left if 60 was smaller and right if it was larger",
					"reply": "Exactly. That one comparison per node is the whole search algorithm."
				},
				{
					"text": "Checked the nodes from left to right",
					"reply": "That would visit nearly every node. Your path skipped most of the tree. What decided each turn?"
				},
				{
					"text": "Always went to the larger child",
					"reply": "That happened to work for 60 at 50, but not at 70. What decided each turn?"
				}
			],
			"answer": 0
		}],
		explain: { "pages": [{
			"title": "How search works",
			"steps": [
				"Start at the root.",
				"Compare the key you want with the node's key.",
				"Equal: you have found it.",
				"Smaller: go left.",
				"Larger: go right.",
				"Empty spot: the key is not in the tree.",
				"Each step throws away a whole subtree, so you visit at most height + 1 nodes. In tree T that is 3."
			],
			"diagram": {
				"tree": "T",
				"highlight": { "edgeLabels": [[
					50,
					30,
					"smaller: left"
				], [
					50,
					70,
					"larger: right"
				]] }
			},
			"pseudocode": "search"
		}] },
		worked: { "examples": [{
			"label": "Search for 60",
			"pseudocode": "search",
			"steps": [{ "search": {
				"tree": "T",
				"key": 60
			} }]
		}, {
			"label": "Search for 45",
			"pseudocode": "search",
			"steps": [{ "search": {
				"tree": "T",
				"key": 45
			} }]
		}] },
		tryIt: {
			"kind": "search",
			"title": "Search for 80",
			"tree": "T",
			"key": 80
		},
		activity: {
			"title": "Find the path",
			"items": [
				{
					"id": "l2-search-20",
					"outcome": "LO3",
					"tree": "T",
					"ask": {
						"kind": "searchPath",
						"key": 20
					},
					"prompt": "Click the nodes visited when searching for {20}, in order. Then give the result.",
					"hints": [{ "text": "At each node, ask: is {20} smaller or larger than this node?" }, {
						"text": "The half of the tree that cannot hold {20} is now dimmed.",
						"highlight": "otherHalf"
					}],
					"explanation": "The search visits {path} and finds {20}.",
					"misconception": "Thinking a search checks every node."
				},
				{
					"id": "l2-search-65",
					"outcome": "LO3",
					"tree": "T",
					"ask": {
						"kind": "searchPath",
						"key": 65
					},
					"intro": "Predict first, then check.",
					"prompt": "Searching for {65} in this tree: which nodes are visited, and what is the result?",
					"parts": [{
						"type": "pick",
						"options": [
							"{path}, then an empty spot: not found",
							"{50}, {70}, {80}, then an empty spot: not found",
							"{path}, {65}: found",
							"{50}, {30}, {40}, then an empty spot: not found"
						],
						"answer": 0,
						"shuffle": true
					}],
					"hints": [{ "text": "Is {65} smaller or larger than {50}? Then than {70}?" }, {
						"text": "The half that cannot hold {65} is dimmed.",
						"highlight": "otherHalf"
					}],
					"explanation": "The search visits {path}, then reaches the empty {side} side of {endAt}: not found.",
					"misconception": "Stopping at a leaf instead of at an empty spot."
				},
				{
					"id": "l2-search-end-45",
					"outcome": "LO3",
					"tree": "T",
					"ask": {
						"kind": "searchEnd",
						"key": 45
					},
					"prompt": "Searching for {45}: which node's empty side ends the search?",
					"hints": [{ "text": "Is {45} smaller or larger than {50}? Keep comparing until the spot you need is empty." }, {
						"text": "The half that cannot hold {45} is dimmed.",
						"highlight": "otherHalf"
					}],
					"explanation": "{path}, then the {side} side of {endAt} is empty, so the search stops there.",
					"misconception": "Stopping at a leaf instead of at an empty spot."
				},
				{
					"id": "l2-max-visits",
					"outcome": "LO3",
					"tree": "T",
					"ask": { "kind": "maxVisits" },
					"prompt": "What is the most nodes a search can visit in this tree?",
					"hints": [{ "text": "Each comparison moves you one level down. How many levels are there?" }, {
						"text": "The longest root-to-leaf path is highlighted.",
						"highlight": "longestPath"
					}],
					"explanation": "At most height + 1 = {most} nodes, one per level.",
					"misconception": "Thinking a search checks every node."
				},
				{
					"id": "l2-empty-spot",
					"outcome": "LO3",
					"tree": "T",
					"ask": { "kind": "fixed" },
					"prompt": "What does a search return when it reaches an empty spot?",
					"parts": [{
						"type": "pick",
						"options": [
							"The last node it visited",
							"Not found",
							"The root",
							"The nearest key"
						],
						"answer": 1
					}],
					"hints": [{ "text": "If the key were in the tree, where would it have to be?" }, {
						"text": "An empty spot is shown on the tree. Could the key be anywhere else?",
						"highlight": { "slot": {
							"parent": 40,
							"side": "right"
						} }
					}],
					"explanation": "Not found. If the key were in the tree, it would have to be in that empty spot.",
					"misconception": "Stopping at a leaf instead of at an empty spot."
				}
			]
		}
	},
	3: {
		lesson: 3,
		title: "Insert, minimum and maximum",
		short: "Insert",
		minutes: 15,
		outcomes: ["LO4"],
		summary: "Predict where a new key goes, and find the smallest and largest keys.",
		hook: {
			"goal": "Predict the tree that results from inserting keys, and find its minimum and maximum keys.",
			"scenario": {
				"title": "Adding a contact",
				"text": "You add a new contact to your phone. The search from Lesson 2 must still be able to find it. Where should it go?",
				"recall": "In a price list stored as a BST, do you need to look at every price to find the cheapest?"
			},
			"warmUp": {
				"question": "In tree T, where does a search for 45 stop?",
				"tree": "T",
				"options": [
					{
						"text": "At the empty right side of 40",
						"reply": "Yes: 50, 30, 40, then the right side of 40 is empty. Keep that spot in mind."
					},
					{
						"text": "At 40, because 40 is close to 45",
						"reply": "A search only stops at an equal key or an empty spot. 45 is larger than 40, so it goes right."
					},
					{
						"text": "At the empty left side of 60",
						"reply": "45 is smaller than 50, so the search never goes right of the root."
					}
				],
				"answer": 0
			}
		},
		explore: [{
			"kind": "slotProbe",
			"tree": "T",
			"key": 45
		}, {
			"kind": "reflect",
			"prompt": "Where did your key have to go for the search to find it?",
			"options": [
				{
					"text": "Exactly where the search for it ends: the empty spot it reaches",
					"reply": "Yes. Insert is search, plus one new leaf where the search stops."
				},
				{
					"text": "Anywhere along the bottom of the tree",
					"reply": "Only one bottom spot works: the one the search reaches."
				},
				{
					"text": "Next to the closest key",
					"reply": "40 is close to 45, but only one side of it works. Which side did the search reach?"
				}
			],
			"answer": 0
		}],
		explain: { "pages": [{
			"title": "Insert",
			"steps": [
				"Search for the key.",
				"When you reach an empty spot, put a new node there.",
				"New nodes always become leaves.",
				"No existing node moves.",
				"Inserting a key that is already in the tree changes nothing."
			],
			"diagram": {
				"tree": "T2",
				"highlight": {
					"found": 45,
					"edges": [
						[50, 30],
						[30, 40],
						[40, 45]
					]
				}
			},
			"caption": "Inserting 45 follows the search path 50, 30, 40.",
			"pseudocode": "insert"
		}, {
			"title": "Minimum and maximum",
			"steps": [
				"Minimum: go left until there is no left child.",
				"Maximum: go right until there is no right child.",
				"No comparisons are needed.",
				"The minimum can have a right child, so it is not always a leaf."
			],
			"diagram": {
				"tree": "T",
				"highlight": {
					"edges": [
						[50, 30],
						[30, 20],
						[50, 70],
						[70, 80]
					],
					"tags": {
						"20": "min",
						"80": "max"
					}
				}
			}
		}] },
		worked: { "examples": [
			{
				"label": "Build T",
				"pseudocode": "insert",
				"steps": [{ "build": [
					50,
					30,
					70,
					20,
					40,
					60,
					80
				] }]
			},
			{
				"label": "Insert 45",
				"pseudocode": "insert",
				"steps": [{ "insert": {
					"tree": "T",
					"key": 45
				} }]
			},
			{
				"label": "Min and max",
				"steps": [{ "extreme": {
					"tree": "T",
					"which": "min"
				} }, { "extreme": {
					"tree": "T",
					"which": "max"
				} }]
			}
		] },
		tryIt: {
			"kind": "insert",
			"title": "Insert 65",
			"tree": "T",
			"key": 65
		},
		activity: {
			"title": "Grow the tree",
			"items": [
				{
					"id": "l3-insert-10",
					"outcome": "LO4",
					"tree": "T",
					"ask": {
						"kind": "insertSlot",
						"key": 10
					},
					"prompt": "Insert {10} into this tree. Where does it go?",
					"hints": [{ "text": "First search for {10}, as if you were looking for it." }, {
						"text": "The empty spot where the search for {10} stops is marked. That is where a new node goes.",
						"highlight": "emptySpot"
					}],
					"explanation": "Searching for {10} visits {path} and stops at the empty {side} side of {endAt}, so {10} becomes the {side} child of {endAt}.",
					"misconception": "Thinking new keys go at the root, or that inserting moves existing nodes."
				},
				{
					"id": "l3-insert-55",
					"outcome": "LO4",
					"tree": "T",
					"ask": {
						"kind": "insertSlot",
						"key": 55
					},
					"prompt": "Insert {55} into this tree. Where does it go?",
					"hints": [{ "text": "First search for {55}, as if you were looking for it." }, {
						"text": "The empty spot where the search for {55} stops is marked. That is where a new node goes.",
						"highlight": "emptySpot"
					}],
					"explanation": "Searching for {55} visits {path} and stops at the empty {side} side of {endAt}, so {55} becomes the {side} child of {endAt}.",
					"misconception": "Thinking new keys go at the root, or that inserting moves existing nodes."
				},
				{
					"id": "l3-duplicate",
					"outcome": "LO4",
					"tree": "T",
					"ask": { "kind": "fixed" },
					"prompt": "Insert {50} into this tree again. What happens?",
					"parts": [{
						"type": "pick",
						"options": [
							"Nothing changes: duplicates are not added",
							"A second {50} becomes the left child of {50}",
							"The tree is rebuilt from the start",
							"{50} goes to the right of {80}"
						],
						"answer": 0,
						"shuffle": true
					}],
					"hints": [{ "text": "First search for {50}. Where does the search end?" }, {
						"text": "The search finds {50} straight away at the root.",
						"highlight": { "visited": [50] }
					}],
					"explanation": "Nothing changes. The search finds the key, and this app does not allow duplicate keys."
				},
				{
					"id": "l3-build",
					"outcome": "LO4",
					"ask": {
						"kind": "build",
						"keys": [
							40,
							20,
							60,
							10
						]
					},
					"prompt": "Build a BST by inserting {40}, {20}, {60}, {10} in that order.",
					"hints": [{ "text": "The first key becomes the root. Then search for each new key before placing it." }, { "text": "{40} is the root. {20} is smaller, so it goes left. Where do {60} and {10} go?" }],
					"explanation": "Root {40}; left child {20} with left child {10}; right child {60}.",
					"misconception": "Thinking new keys go at the root, or that inserting moves existing nodes."
				},
				{
					"id": "l3-min-max",
					"outcome": "LO4",
					"tree": "T",
					"ask": {
						"kind": "minMax",
						"find": ["min", "max"]
					},
					"prompt": "Click the minimum key, then the maximum key.",
					"hints": [{ "text": "You do not need to compare anything. Which direction leads to smaller keys?" }, {
						"text": "The far-left and far-right paths are highlighted.",
						"highlight": "extremePaths"
					}],
					"explanation": "Minimum {min} (go left until you cannot). Maximum {max} (go right until you cannot).",
					"misconception": "Thinking the minimum must be a leaf."
				},
				{
					"id": "l3-subtree-min",
					"outcome": "LO4",
					"tree": "T",
					"ask": {
						"kind": "minMax",
						"find": ["min"],
						"from": 70
					},
					"prompt": "Click the smallest key in the subtree rooted at {70}.",
					"hints": [{ "text": "Start at {70}. Which way leads to smaller keys?" }, {
						"text": "From {70}, the path going left is highlighted.",
						"highlight": "extremePaths"
					}],
					"explanation": "{min}: from {70}, go left until there is no left child.",
					"bridge": "Remember this one for delete."
				}
			]
		}
	},
	4: {
		lesson: 4,
		title: "Traversals",
		short: "Traversals",
		minutes: 15,
		outcomes: ["LO5"],
		summary: "Write the pre-order, in-order and post-order sequences, and explain why in-order is sorted.",
		hook: {
			"goal": "Produce the in-order, pre-order and post-order sequences of a BST, and explain why in-order is sorted.",
			"scenario": {
				"title": "Listing every file",
				"text": "To list every file in a set of nested folders, you have to visit every folder exactly once.",
				"recall": "Does the order you list them in matter?"
			},
			"warmUp": {
				"question": "In tree T, what is the subtree rooted at 30?",
				"tree": "T",
				"options": [
					{
						"text": "30, 20 and 40",
						"reply": "Yes: a subtree is a node and everything below it."
					},
					{
						"text": "30 only",
						"reply": "A subtree includes everything below the node too."
					},
					{
						"text": "20 and 40 only",
						"reply": "The subtree includes the node it is rooted at."
					},
					{
						"text": "50, 30, 20 and 40",
						"reply": "50 is above 30, so it is not in 30's subtree."
					}
				],
				"answer": 0
			}
		},
		explore: [
			{
				"kind": "walk",
				"tree": "T"
			},
			{
				"kind": "orderGuess",
				"tree": "T",
				"order": "pre"
			},
			{
				"kind": "reflect",
				"prompt": "When did you write each node down: before, between or after its children?",
				"options": [
					{
						"text": "Before its children",
						"reply": "That is pre-order. The other two choices are also traversals; you will see all three next."
					},
					{
						"text": "Between its two children",
						"reply": "That is in-order. The other two choices are also traversals; you will see all three next."
					},
					{
						"text": "After its children",
						"reply": "That is post-order. The other two choices are also traversals; you will see all three next."
					}
				],
				"answer": null
			}
		],
		explain: { "pages": [{
			"title": "Three ways to walk the tree",
			"steps": [
				"A traversal visits every node exactly once.",
				"Pre-order: node, left subtree, right subtree.",
				"In-order: left subtree, node, right subtree.",
				"Post-order: left subtree, right subtree, node.",
				"Memory aid: \"pre\" is before the children, \"in\" is between them, \"post\" is after them.",
				"On the diagram, the dot on the left of a node marks pre-order, below marks in-order, and on the right marks post-order."
			],
			"diagram": {
				"tree": "T",
				"highlight": { "dots": "all" }
			},
			"caption": "Walk around the outside of the tree, starting left of the root. Write a node when you pass the dot for your order.",
			"pseudocode": "traverse"
		}] },
		worked: { "examples": [
			{
				"label": "Pre-order",
				"pseudocode": "traverse",
				"steps": [{ "traversal": {
					"tree": "T",
					"order": "pre"
				} }]
			},
			{
				"label": "In-order",
				"pseudocode": "traverse",
				"steps": [{ "traversal": {
					"tree": "T",
					"order": "in"
				} }]
			},
			{
				"label": "Post-order",
				"pseudocode": "traverse",
				"steps": [{ "traversal": {
					"tree": "T",
					"order": "post"
				} }]
			},
			{
				"label": "Compare",
				"steps": [{
					"tree": "T",
					"highlight": { "dots": "all" },
					"text": "Pre-order: 50 30 20 40 70 60 80. In-order: 20 30 40 50 60 70 80. Post-order: 20 40 30 60 80 70 50."
				}, {
					"tree": "T",
					"highlight": { "dots": "in" },
					"text": "Only in-order is sorted. The BST rule puts every smaller key to the left of a node and every larger key to the right, and in-order writes left, then node, then right."
				}]
			}
		] },
		tryIt: {
			"kind": "traversal",
			"title": "Pre-order of the subtree rooted at 30",
			"tree": "T",
			"order": "pre",
			"from": 30
		},
		activity: {
			"title": "Walk the tree",
			"items": [
				{
					"id": "l4-in-order",
					"outcome": "LO5",
					"tree": "T",
					"ask": {
						"kind": "traversal",
						"order": "in"
					},
					"prompt": "Write the in-order sequence for this tree.",
					"hints": [{ "text": "Memory aid: \"pre\" is before the children, \"in\" is between them, \"post\" is after them." }, {
						"text": "Dots are now on the tree: a node is written when the walk passes its bottom dot.",
						"highlight": "dots"
					}],
					"explanation": "In-order for this tree: {sequence}.",
					"misconception": "Thinking a traversal goes level by level."
				},
				{
					"id": "l4-pre-order",
					"outcome": "LO5",
					"tree": "T",
					"ask": {
						"kind": "traversal",
						"order": "pre"
					},
					"prompt": "Write the pre-order sequence for this tree.",
					"hints": [{ "text": "Memory aid: \"pre\" is before the children, \"in\" is between them, \"post\" is after them." }, {
						"text": "Dots are now on the tree: a node is written when the walk passes its left dot.",
						"highlight": "dots"
					}],
					"explanation": "Pre-order for this tree: {sequence}.",
					"misconception": "Mixing up pre-order and post-order."
				},
				{
					"id": "l4-post-order",
					"outcome": "LO5",
					"tree": "T",
					"ask": {
						"kind": "traversal",
						"order": "post"
					},
					"prompt": "Write the post-order sequence for this tree.",
					"hints": [{ "text": "Memory aid: \"pre\" is before the children, \"in\" is between them, \"post\" is after them." }, {
						"text": "Dots are now on the tree: a node is written when the walk passes its right dot.",
						"highlight": "dots"
					}],
					"explanation": "Post-order for this tree: {sequence}.",
					"misconception": "Mixing up pre-order and post-order."
				},
				{
					"id": "l4-pre-order-70",
					"outcome": "LO5",
					"tree": "T",
					"ask": {
						"kind": "traversal",
						"order": "pre",
						"from": 70
					},
					"prompt": "Write the pre-order sequence for the subtree rooted at {70}.",
					"hints": [{ "text": "Memory aid: \"pre\" is before the children, \"in\" is between them, \"post\" is after them." }, {
						"text": "Dots are now on the tree: a node is written when the walk passes its left dot.",
						"highlight": "dots"
					}],
					"explanation": "Pre-order for the subtree rooted at {70}: {sequence}.",
					"misconception": "Mixing up pre-order and post-order."
				},
				{
					"id": "l4-post-order-t2",
					"outcome": "LO5",
					"tree": "T2",
					"ask": {
						"kind": "traversal",
						"order": "post"
					},
					"prompt": "Write the post-order sequence for this tree (T with {45} added).",
					"hints": [{ "text": "Memory aid: \"pre\" is before the children, \"in\" is between them, \"post\" is after them." }, {
						"text": "Dots are now on the tree: a node is written when the walk passes its right dot.",
						"highlight": "dots"
					}],
					"explanation": "Post-order for this tree (T with {45} added): {sequence}.",
					"misconception": "Mixing up pre-order and post-order."
				},
				{
					"id": "l4-why-sorted",
					"outcome": "LO5",
					"tree": "T",
					"ask": { "kind": "fixed" },
					"prompt": "Why is the in-order sequence of a BST sorted?",
					"parts": [{
						"type": "pick",
						"options": [
							"Every left key is smaller and every right key is larger, so writing left, then node, then right goes from small to large",
							"In-order visits the tree level by level",
							"Insert puts the keys in sorted order",
							"The root is always the middle key"
						],
						"answer": 0,
						"shuffle": true
					}],
					"hints": [{ "text": "In-order writes the left subtree, then the node, then the right subtree. What does the BST rule say about those?" }, {
						"text": "The in-order dots are shown. Read them from left to right.",
						"highlight": { "dots": "in" }
					}],
					"explanation": "The BST rule puts every smaller key on the left and every larger key on the right, and in-order writes left, node, right.",
					"misconception": "Thinking a traversal goes level by level."
				}
			]
		}
	},
	5: {
		lesson: 5,
		title: "Delete",
		short: "Delete",
		minutes: 18,
		outcomes: ["LO6"],
		summary: "Delete a key in each of the three cases and draw the resulting tree.",
		hook: {
			"goal": "Delete a key from a BST in each of the three cases (leaf, one child, two children) and describe the resulting tree.",
			"scenario": {
				"title": "Removing a contact",
				"text": "You delete a contact. The search from Lesson 2 must still find everyone else.",
				"recall": "What could go wrong when you take a node out of the middle of the tree?"
			},
			"warmUp": {
				"question": "In tree T, what is the smallest key in the subtree rooted at 70?",
				"tree": "T",
				"options": [
					{
						"text": "60",
						"reply": "Yes: from 70, go left until you cannot. You will need this in a few minutes."
					},
					{
						"text": "70",
						"reply": "70 is the root of that subtree. Go left from it."
					},
					{
						"text": "20",
						"reply": "20 is the smallest key in the whole tree, not in the subtree rooted at 70."
					},
					{
						"text": "80",
						"reply": "80 is the largest key in that subtree."
					}
				],
				"answer": 0
			}
		},
		explore: [{
			"kind": "deleteTry",
			"cases": [
				{
					"label": "Remove 20 from T",
					"tree": "T",
					"key": 20,
					"options": [{
						"text": "Nothing moves: 20 is a leaf, so just take it out",
						"result": "delete"
					}, {
						"text": "Move 40 into the empty spot",
						"result": { "shape": [
							50,
							[30, [40]],
							[
								70,
								[60],
								[80]
							]
						] }
					}]
				},
				{
					"label": "Remove 40 from T2",
					"tree": "T2",
					"key": 40,
					"options": [
						{
							"text": "Move 45 up into 40's place",
							"result": "delete"
						},
						{
							"text": "Hang 45 under 20 instead",
							"result": { "shape": [
								50,
								[30, [
									20,
									null,
									[45]
								]],
								[
									70,
									[60],
									[80]
								]
							] }
						},
						{
							"text": "Leave the gap empty",
							"result": null
						}
					]
				},
				{
					"label": "Remove 70 from T",
					"tree": "T",
					"key": 70,
					"options": [
						{
							"text": "Move 60 up and hang 80 under it",
							"result": { "shape": [
								50,
								[
									30,
									[20],
									[40]
								],
								[
									60,
									null,
									[80]
								]
							] }
						},
						{
							"text": "Move 80 up and hang 60 under it",
							"result": "delete"
						},
						{
							"text": "Leave the gap empty",
							"result": null
						}
					],
					"note": "That keeps the rule here, but only because 60 and 80 are leaves. If they had their own children, one of them would have nowhere to go. The lesson shows a method that always works."
				}
			]
		}, {
			"kind": "reflect",
			"prompt": "Which removal was hardest, and why?",
			"options": [
				{
					"text": "Removing 70: it had two children, so it was not obvious what should replace it",
					"reply": "Most students say so. Case 3 needs a rule, the in-order successor, which you will see next."
				},
				{
					"text": "Removing 40: its child had to move up",
					"reply": "Moving a single child up is case 2. The two-children case needs a rule; you will see it next."
				},
				{
					"text": "Removing 20: nothing had to move",
					"reply": "A leaf is the easy case. The two-children case needs a rule; you will see it next."
				}
			],
			"answer": null
		}],
		explain: { "pages": [{
			"title": "Three cases",
			"steps": [
				"Step 0: find the node with search.",
				"Case 1, leaf: remove it.",
				"Case 2, one child: replace the node with its child. The child's whole subtree moves up.",
				"Case 3, two children: find the in-order successor, the minimum of the right subtree.",
				"Copy the successor's key into the node.",
				"Then delete the successor's old node from the right subtree. It has at most one child, so this is case 1 or 2.",
				"Why it works: the successor is larger than every key on the left and smaller than every other key on the right, so the BST rule still holds."
			],
			"note": "The mirror option uses the predecessor, the maximum of the left subtree. This app uses the successor.",
			"diagram": {
				"tree": "T",
				"highlight": {
					"tags": {
						"20": "case 1",
						"70": "case 3"
					},
					"found": 80,
					"outlined": [80]
				}
			},
			"caption": "20 is a leaf, so deleting it is case 1. 70 has two children, so deleting it is case 3; its successor is 80.",
			"pseudocode": "delete"
		}] },
		worked: { "examples": [
			{
				"label": "Delete 20",
				"deleteCase": "leaf",
				"pseudocode": "delete",
				"steps": [{ "delete": {
					"tree": "T",
					"key": 20
				} }]
			},
			{
				"label": "Delete 40 from T2",
				"deleteCase": "one",
				"pseudocode": "delete",
				"steps": [{ "delete": {
					"tree": "T2",
					"key": 40
				} }]
			},
			{
				"label": "Delete 70",
				"deleteCase": "two",
				"pseudocode": "delete",
				"steps": [{ "delete": {
					"tree": "T",
					"key": 70
				} }]
			},
			{
				"label": "Delete the root, 50",
				"deleteCase": "two",
				"pseudocode": "delete",
				"steps": [{ "delete": {
					"tree": "T",
					"key": 50
				} }]
			}
		] },
		tryIt: {
			"kind": "guided",
			"title": "Delete 70 from T",
			"tree": "T",
			"steps": [
				{
					"ask": "choice",
					"prompt": "How many children does 70 have?",
					"options": [
						"None",
						"One",
						"Two"
					],
					"answer": 2,
					"right": "Two children, 60 and 80, so this is case 3.",
					"wrong": "Look directly below 70."
				},
				{
					"ask": "node",
					"prompt": "Click the in-order successor of 70: the smallest key in its right subtree.",
					"answer": { "successorOf": 70 },
					"highlight": { "outlined": [80] },
					"right": "80. Go right to 80, then left as far as you can; 80 has no left child.",
					"wrong": "Start in 70's right subtree (outlined), then go left as far as you can."
				},
				{
					"ask": "choice",
					"prompt": "What goes into 70's place?",
					"options": [
						"Copy 80 into the node",
						"Move 60 up",
						"Leave the spot empty"
					],
					"answer": 0,
					"right": "Copy 80 into the node that held 70.",
					"wrong": "Case 3 always uses the successor you just found.",
					"after": {
						"tree": "T",
						"highlight": {
							"relabel": { "70": 80 },
							"ghost": 80
						}
					}
				},
				{
					"ask": "choice",
					"prompt": "What happens to the old 80 node?",
					"options": [
						"Remove it: it is a leaf (case 1)",
						"Leave it where it is",
						"Move it under 60"
					],
					"answer": 0,
					"right": "Done. 80 now has left child 60, and the in-order sequence is still sorted.",
					"wrong": "The old 80 is now a duplicate. It must go.",
					"after": {
						"tree": {
							"from": "T",
							"delete": [70]
						},
						"highlight": { "found": 80 }
					}
				}
			]
		},
		activity: {
			"title": "Remove it",
			"items": [
				{
					"id": "l5-delete-60",
					"outcome": "LO6",
					"tree": "T",
					"ask": {
						"kind": "delete",
						"key": 60,
						"result": {
							"options": [
								"{70} keeps only its right child {80}",
								"{80} moves into {60}'s place",
								"{70} is removed as well",
								"{50} gets a new right child"
							],
							"answer": 0
						}
					},
					"prompt": "Delete {60} from this tree.",
					"hints": [{ "text": "Count the children of {60} first." }, {
						"text": "{60} is marked. With no children, nothing has to move.",
						"highlight": "children"
					}],
					"explanation": "{caseName}. {70} keeps only its right child {80}."
				},
				{
					"id": "l5-delete-40",
					"outcome": "LO6",
					"tree": "T2",
					"ask": {
						"kind": "delete",
						"key": 40,
						"result": {
							"options": [
								"{45} takes {40}'s place as the right child of {30}",
								"{45} becomes the left child of {20}",
								"{45} is removed as well",
								"{30} moves down into {40}'s place"
							],
							"answer": 0
						}
					},
					"prompt": "Delete {40} from this tree.",
					"hints": [{ "text": "Count the children of {40} first." }, {
						"text": "{40} is marked with its child outlined. With one child, that child moves up.",
						"highlight": "children"
					}],
					"explanation": "{caseName}. {45} takes {40}'s place as the right child of {30}."
				},
				{
					"id": "l5-delete-30",
					"outcome": "LO6",
					"tree": "T",
					"ask": {
						"kind": "delete",
						"key": 30,
						"successor": true,
						"result": {
							"options": [
								"The node becomes {40}, with left child {20} and no right child",
								"The node becomes {20}, with right child {40}",
								"{40} becomes the root",
								"The node becomes {40}, with left child {20} and right child {40}"
							],
							"answer": 0
						}
					},
					"prompt": "Delete {30} from this tree, using the in-order successor.",
					"hints": [{ "text": "Count the children of {30} first." }, {
						"text": "The right subtree of {30} is outlined. Its leftmost node is the successor.",
						"highlight": "rightSubtree"
					}],
					"explanation": "{caseName}. The successor is {successor}: go right, then left as far as you can. Copy {successor} into the node and remove the old {successor}. The node becomes {40}, with left child {20} and no right child.",
					"misconception": "Promoting a child automatically when there are two, or forgetting to remove the successor's old node."
				},
				{
					"id": "l5-delete-50",
					"outcome": "LO6",
					"tree": "T",
					"ask": {
						"kind": "delete",
						"key": 50,
						"successor": true,
						"result": {
							"options": [
								"The root becomes {60}, and {70} keeps only its right child {80}",
								"The root becomes {70}, with children {30} and {80}",
								"The root becomes {30}",
								"The root becomes {60}, and {70} keeps both children"
							],
							"answer": 0
						}
					},
					"prompt": "Delete {50} from this tree, using the in-order successor.",
					"hints": [{ "text": "Count the children of {50} first." }, {
						"text": "The right subtree of {50} is outlined. Its leftmost node is the successor.",
						"highlight": "rightSubtree"
					}],
					"explanation": "{caseName}. The successor is {successor}: go right to {70}, then left as far as you can. Copy {successor} into the root and remove the old {successor}, so {70} keeps only its right child {80}.",
					"misconception": "Choosing the minimum of the whole tree instead of the minimum of the right subtree."
				},
				{
					"id": "l5-successor",
					"outcome": "LO6",
					"tree": "T",
					"ask": {
						"kind": "successor",
						"key": 50
					},
					"prompt": "Click the in-order successor of {50}.",
					"hints": [{ "text": "The successor is the smallest key in the right subtree." }, {
						"text": "The right subtree of {50} is outlined. Find its leftmost node.",
						"highlight": "rightSubtree"
					}],
					"explanation": "{successor}: go right to {70}, then left as far as you can.",
					"misconception": "Choosing the minimum of the whole tree instead of the minimum of the right subtree."
				},
				{
					"id": "l5-still-sorted",
					"outcome": "LO6",
					"tree": {
						"from": "T",
						"delete": [50]
					},
					"ask": { "kind": "fixed" },
					"intro": "This is tree T after deleting the root.",
					"prompt": "After any delete, is the in-order sequence still sorted?",
					"parts": [{
						"type": "pick",
						"options": ["Yes", "No"],
						"answer": 0
					}],
					"hints": [{ "text": "A correct delete keeps the BST rule. What does the BST rule guarantee about in-order?" }, {
						"text": "In-order dots are shown on the tree. Read them from left to right.",
						"highlight": { "dots": "in" }
					}],
					"explanation": "Yes. A correct delete keeps the BST rule, and the BST rule makes in-order sorted."
				}
			]
		}
	}
};
function loadAll() {
	const specs = {};
	const seen = /* @__PURE__ */ new Map();
	for (const n of [
		1,
		2,
		3,
		4,
		5
	]) {
		const file = `lesson${n}.json`;
		const spec = validateLesson(FILES[n], file);
		if (spec.lesson !== n) throw new Error(`${file}: "lesson" is ${spec.lesson}, but the file is lesson ${n}`);
		for (const item of spec.activity.items) {
			const other = seen.get(item.id);
			if (other !== void 0) throw new Error(`${file}: item id "${item.id}" is also used in lesson${other}.json`);
			seen.set(item.id, n);
		}
		specs[n] = spec;
	}
	return Object.freeze(specs);
}
var LESSON_SPECS = loadAll();
function checkNumber(n) {
	if (!Object.hasOwn(LESSON_SPECS, n)) throw new RangeError(`There is no lesson ${String(n)}; the lessons are 1 to 5`);
}
function activityQuestions(n, retake = 0) {
	checkNumber(n);
	return LESSON_SPECS[n].activity.items.map((item) => resolveItem(item, n, retake));
}
// src/content/finalTest.ts
/**
* The final test (`data/final.json`): ten items on tree U, no hints, and the
* rules for the results screen.
*
* - An outcome is secure when every item for it is right; otherwise the
*   screen says "Listen for this in the lecture".
* - The overall descriptor is the first whose `min` the score reaches and
*   whose `requires` items are all right (the ID document's Excellent band
*   needs the two-children delete).
* - The lecture question is the one for the first outcome that is not secure,
*   or the last outcome's if every outcome is secure.
*/
var OUTCOME_IDS = [
	"LO1",
	"LO2",
	"LO3",
	"LO4",
	"LO5",
	"LO6"
];
var finalItem = refine(item, (value, path) => {
	if (value.hints.length > 0) bad(`${path}.hints`, "must be empty: the final test has no hints");
});
var file$1 = object({
	title: plainText,
	minutes: positiveInt,
	summary: plainText,
	banner: plainText,
	firstNote: plainText,
	retakeNote: plainText,
	outcomes: list(object({
		id: literal(...OUTCOME_IDS),
		name: plainText,
		lectureQuestion: plainText
	}), { min: 1 }),
	descriptors: list(object({
		name: plainText,
		min: int,
		meaning: plainText
	}, { requires: list(text, { min: 1 }) }), { min: 1 }),
	items: list(finalItem, { min: 1 })
});
/** Check the final test file, throwing an Error naming the first problem and where it is. */
function validateFinal(input, name = "final.json") {
	try {
		const spec = file$1(input, "");
		const outcomeIds = spec.outcomes.map((outcome) => outcome.id);
		if (new Set(outcomeIds).size !== outcomeIds.length) bad("outcomes", "must not repeat an outcome");
		const ids = /* @__PURE__ */ new Set();
		spec.items.forEach((entry, i) => {
			if (ids.has(entry.id)) bad(`items[${i}].id`, `repeats the id "${entry.id}"`);
			ids.add(entry.id);
			if (!outcomeIds.includes(entry.outcome)) bad(`items[${i}].outcome`, `is ${entry.outcome}, which is not in "outcomes"`);
		});
		for (const id of outcomeIds) if (!spec.items.some((entry) => entry.outcome === id)) bad("outcomes", `lists ${id}, but no item assesses it`);
		spec.descriptors.forEach((descriptor, i) => {
			const path = `descriptors[${i}]`;
			if (descriptor.min < 0 || descriptor.min > spec.items.length) bad(`${path}.min`, `must be from 0 to ${spec.items.length}, the number of items`);
			if (i > 0 && descriptor.min >= spec.descriptors[i - 1].min) bad(`${path}.min`, "must be lower than the one before: descriptors go from highest to lowest");
			for (const id of descriptor.requires ?? []) if (!ids.has(id)) bad(`${path}.requires`, `names "${id}", which is not an item`);
		});
		const last = spec.descriptors.at(-1);
		if (last?.min !== 0 || last.requires !== void 0) bad("descriptors", "must end with one that has min 0 and no \"requires\", so every score gets a descriptor");
		return deepFreeze$1(spec);
	} catch (error) {
		if (error instanceof ShapeError) throw new Error(`${name}: ${error.message}`);
		throw error;
	}
}
function load() {
	const spec = validateFinal(final_default);
	const lessonIds = new Set(Object.values(LESSON_SPECS).flatMap((lesson) => lesson.activity.items.map((i) => i.id)));
	for (const entry of spec.items) if (lessonIds.has(entry.id)) throw new Error(`final.json: item id "${entry.id}" is also used in a lesson`);
	return spec;
}
/** The final test file, checked when the content module loads. */
var FINAL_TEST = load();
/** The final test's questions for a retake (0 is the original keys), in order. */
function finalQuestions(retake = 0) {
	return FINAL_TEST.items.map((entry) => resolveItem(entry, "final", retake));
}
// src/content/answerSheet.ts
/**
* The answer sheet: every activity item's prompt and its answers on every
* retake, as markdown. `npm run answers` writes it to docs/answer-sheet.md,
* and a test checks that file is up to date with the lesson files.
*/
function slotInWords(key, slot) {
	return slot.parent === null ? `${key} → root` : `${key} → ${slot.side} of ${slot.parent}`;
}
/** One part's answer in words. */
function answerInWords(part) {
	switch (part.type) {
		case "pick": return part.options[part.answer];
		case "click": return typeof part.answer === "number" ? String(part.answer) : part.answer.join(", ");
		case "order": return part.answer.join(" ");
		case "place": return part.answer.map((slot, i) => slotInWords(part.keys[i], slot)).join("; ");
	}
}
/** A question's answers in words, each part labelled when it has a label. */
function questionAnswer(question) {
	return question.parts.map((part) => {
		if (part.label === "") return answerInWords(part);
		return `${part.label}${part.label.endsWith("?") ? "" : ":"} ${answerInWords(part)}`;
	}).join(" · ");
}
/** Escape the characters that would break a markdown table cell. */
function cell(text) {
	return text.replace(/\|/g, "\\|");
}
function answerSheet() {
	const retakes = CONFIG.retakeOffsets.map((_, retake) => retake);
	const lines = [
		"# Answer sheet",
		"",
		"Generated by `npm run answers` from the lesson files in `src/content/data`. Do not edit it by hand: change the lesson files and run the command again. A test fails if this file is out of date.",
		"",
		`Each retake shifts every key: ${CONFIG.retakeOffsets.map((offset, retake) => `retake ${retake} by ${offset >= 0 ? "+" : ""}${offset}`).join(", ")}.`,
		""
	];
	/** One section: every item's prompt, then its answers on each retake. */
	const section = (items, questionsFor) => {
		const byRetake = retakes.map(questionsFor);
		items.forEach((item, i) => {
			const first = byRetake[0]?.[i];
			const tags = [item.outcome, first.deleteCase === void 0 ? "" : `delete case: ${first.deleteCase}`].filter((tag) => tag !== "").join(", ");
			lines.push(`### ${i + 1}. \`${item.id}\` (${tags})`, "");
			if (first.intro !== void 0) lines.push(`*${first.intro}*`, "");
			lines.push(first.prompt, "", "| Retake | Answer |", "|---|---|");
			for (const retake of retakes) lines.push(`| ${retake} | ${cell(questionAnswer(byRetake[retake]?.[i]))} |`);
			lines.push("");
		});
	};
	for (const n of [
		1,
		2,
		3,
		4,
		5
	]) {
		const spec = LESSON_SPECS[n];
		lines.push(`## Lesson ${n}: ${spec.title}`, "", `Activity: ${spec.activity.title}.`, "");
		section(spec.activity.items, (retake) => activityQuestions(n, retake));
	}
	lines.push(`## ${FINAL_TEST.title}`, "", FINAL_TEST.summary, "");
	section(FINAL_TEST.items, finalQuestions);
	lines.push("### Results", "", "An outcome is secure when every item for it is right. The descriptor is the first whose score the student reaches (and whose required items are right):", "", "| Descriptor | Score | Also needs |", "|---|---|---|", ...FINAL_TEST.descriptors.map((d, i) => {
		const top = i === 0 ? FINAL_TEST.items.length : FINAL_TEST.descriptors[i - 1].min - 1;
		return `| ${d.name} | ${d.min} to ${top} | ${(d.requires ?? []).map((id) => `\`${id}\``).join(", ") || "nothing more"} |`;
	}), "");
	return lines.join("\n");
}
// scripts/answers.ts
var file = "docs/answer-sheet.md";
writeFileSync(file, answerSheet());
console.log(`Wrote ${file}`);
export {};
