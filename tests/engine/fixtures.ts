/**
  Reference trees from the lesson plan, as plain data.
  Every feature's tests use these, so the expected answers come from the
  lesson plan, not from the code being tested.
 */
import type { Shape } from '../../src/engine/types';

// Tree T: used in every lesson.
export const T_KEYS = [50, 30, 70, 20, 40, 60, 80] as const;
export const T_SHAPE: Shape = [50, [30, [20], [40]], [70, [60], [80]]];

// Tree T2: T after inserting 45 (Lessons 3 to 5). 
export const T2_KEYS = [...T_KEYS, 45] as const;
export const T2_SHAPE: Shape = [50, [30, [20], [40, null, [45]]], [70, [60], [80]]];

// Tree U: the final test. 22 is the left child of 25.
export const U_KEYS = [35, 20, 50, 10, 25, 45, 60, 22] as const;
export const U_SHAPE: Shape = [35, [20, [10], [25, [22]]], [50, [45], [60]]];

// Invalid trees from Lesson 1 and the final test, with the node that breaks the rule.
export const X_SHAPE: Shape = [50, [30], [70, [40]]]; // 40 is right of 50
export const T55_SHAPE: Shape = [50, [30, null, [55]], [70]]; // 55 is left of 50
export const V_SHAPE: Shape = [30, [15, null, [35]], [40]]; // 35 is left of 30

// A valid tree that only looks suspicious (final test item 3).
export const W_SHAPE: Shape = [30, [15, null, [20]], [40, [35]]];