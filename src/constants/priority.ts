import type { Priority } from '../types/defect';
import type { JiraPriority } from '../services/jira-api';

export interface PriorityOption {
  label: string;
  value: Priority;
}

export const DEFAULT_PRIORITY_OPTIONS: PriorityOption[] = [
  { label: 'Blocker', value: '1' },
  { label: 'Critical', value: '2' },
  { label: 'Major', value: '3' },
  { label: 'Minor', value: '4' },
  { label: 'Trivial', value: '5' },
];

export function buildPriorityOptions(priorities: JiraPriority[]): PriorityOption[] {
  if (priorities.length === 0) return DEFAULT_PRIORITY_OPTIONS;
  return priorities.map(p => ({ label: p.name, value: p.id }));
}
