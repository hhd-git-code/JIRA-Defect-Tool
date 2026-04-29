import type { Priority, ReproduceRate } from '../types/defect';

export const COLUMN_MAPPING: Record<string, string> = {
  '标题': 'summary',
  'Title': 'summary',
  'Summary': 'summary',
  '优先级': 'priority',
  'Priority': 'priority',
  '时间点': 'timestamp',
  'Timestamp': 'timestamp',
  '前提条件': 'precondition',
  'Precondition': 'precondition',
  '步骤': 'steps',
  'Steps': 'steps',
  '预期结果': 'expectedResult',
  'Expected Result': 'expectedResult',
  '实际结果': 'actualResult',
  'Actual Result': 'actualResult',
  '复现率': 'reproduceRate',
  'Reproduce Rate': 'reproduceRate',
  'Recover步骤': 'recoverSteps',
  'Recover Steps': 'recoverSteps',
};

const PRIORITY_ZH_MAP: Record<string, string> = {
  '阻塞': 'Blocker',
  '严重': 'Critical',
  '重要': 'Major',
  '一般': 'Minor',
  '轻微': 'Trivial',
};

const REPRODUCE_RATE_ZH_MAP: Record<string, ReproduceRate> = {
  '总是': 'Always',
  '经常': 'Often',
  '有时': 'Sometimes',
  '很少': 'Rarely',
  '无法复现': 'Unable to Reproduce',
};

export function mapPriorityValue(value: string): Priority | '' {
  if (!value) return '';
  const v = PRIORITY_ZH_MAP[value];
  if (v) return v;
  return value;
}

export function mapReproduceRateValue(value: string): ReproduceRate | '' {
  if (!value) return '';
  const v = REPRODUCE_RATE_ZH_MAP[value];
  if (v) return v;
  const validValues = ['Always', 'Often', 'Sometimes', 'Rarely', 'Unable to Reproduce'];
  if (validValues.includes(value)) return value as ReproduceRate;
  return '';
}
