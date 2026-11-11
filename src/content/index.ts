/**
  The content module: lesson data and the resolver that turns it into
  ready-to-show questions. The lessons and assessment screens import from here.
 */
export * from './schema';
export { CONFIG, offsetFor, validateConfig } from './config';
export { TREES, getTree, validateTrees } from './trees';
export { fillText } from './placeholders';
export type { PlaceholderValue } from './placeholders';
export { resolveItem } from './resolve';
export { checkPart, checkQuestion, countsAsCorrect } from './check';
export type { CheckResult, PartResponse } from './check';
export * from './lessonSchema';
export { validateLesson } from './validateLesson';
export { LESSON_SPECS, activityQuestions, getLesson, resolveLesson } from './lessons';
export { FINAL_TEST, finalQuestions, finalResults, validateFinal } from './finalTest';
export type { FinalResults, FinalTestSpec } from './finalTest';