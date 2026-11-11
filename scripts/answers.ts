//  Writes docs/answer-sheet.md from the lesson files. Run with `npm run answers`.
 
import { writeFileSync } from 'node:fs';
import { answerSheet } from '../src/content/answerSheet';

const file = 'docs/answer-sheet.md';
writeFileSync(file, answerSheet());
console.log(`Wrote ${file}`);