/**
  Assessment settings, kept in one place so the team can tune them without
  touching the logic (lesson plan, decision 14).
 */

export type Descriptor = 'Excellent' | 'Good' | 'Satisfactory' | 'Limited';

export interface AssessmentConfig {
  // Share of items needed to pass an end-of-lesson activity.
  readonly passThreshold: number;
  // Share needed for the middle band (explanations, then retry the missed items).
  readonly middleBand: number;
  // Hint rungs before the worked solution: nudge, highlight, solution.
  readonly hintRungs: number;
  // Final test bands as minimum scores, highest first. The team's own choice (decision 16).
  readonly descriptorBands: readonly { readonly min: number; readonly descriptor: Descriptor }[];
}

export const CONFIG: AssessmentConfig = {
  passThreshold: 0.8,
  middleBand: 0.6,
  hintRungs: 3,
  descriptorBands: [
    { min: 9, descriptor: 'Excellent' },
    { min: 7, descriptor: 'Good' },
    { min: 5, descriptor: 'Satisfactory' },
    { min: 0, descriptor: 'Limited' },
  ],
};
