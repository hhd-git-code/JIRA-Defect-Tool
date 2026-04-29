import type { DefectData, ValidationError } from '../types/defect';

const REQUIRED_FIELDS: { field: keyof DefectData; label: string }[] = [
  { field: 'summary', label: '标题' },
  { field: 'priority', label: '优先级' },
  { field: 'timestamp', label: '时间点' },
  { field: 'precondition', label: '前提条件' },
  { field: 'steps', label: '步骤' },
  { field: 'expectedResult', label: '预期结果' },
  { field: 'actualResult', label: '实际结果' },
  { field: 'reproduceRate', label: '复现率' },
  { field: 'recoverSteps', label: 'Recover步骤' },
];

export function validateDefect(defect: DefectData): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const { field, label } of REQUIRED_FIELDS) {
    const value = defect[field];
    if (value == null || (typeof value === 'string' && value.trim() === '')) {
      errors.push({ field, label });
    }
  }
  return errors;
}
