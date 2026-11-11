// Public entry point of the assessment logic. Screens import from here, never from individual files.
// Answer checking, settings and final test results live in src/content (checkQuestion, CONFIG, finalResults).

export * from './hints';
export * from './scoring';
export * from './progress';
