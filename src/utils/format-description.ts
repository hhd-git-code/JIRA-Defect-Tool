import type { TranslatedDefect } from '../types/defect';

export function formatDescription(translated: TranslatedDefect): string {
  return [
    'h2. Timestamp',
    translated.timestampEn,
    '',
    'h2. Precondition',
    translated.preconditionEn,
    '',
    'h2. Steps',
    translated.stepsEn,
    '',
    'h2. Expected Result',
    translated.expectedResultEn,
    '',
    'h2. Actual Result',
    translated.actualResultEn,
    '',
    'h2. Reproduce Rate',
    translated.reproduceRateEn,
    '',
    'h2. Recover Steps',
    translated.recoverStepsEn,
  ].join('\n');
}
